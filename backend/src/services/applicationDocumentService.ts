/**
 * Application Document Service
 * Handles document upload, verification, and management
 */

import { db } from '../utils/database';
import {
  ApplicationDocument,
  DocumentType,
  VerificationStatus
} from '../types/admission';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const UPLOAD_DIR = path.join(__dirname, '../../uploads/admissions');

/**
 * Ensure upload directory exists
 */
async function ensureUploadDir(): Promise<void> {
  try {
    await fs.access(UPLOAD_DIR);
  } catch {
    await fs.mkdir(UPLOAD_DIR, { recursive: true });
  }
}

/**
 * Upload a document for an application
 */
export async function uploadDocument(
  applicationId: string,
  documentType: DocumentType,
  file: {
    name: string;
    data: Buffer;
    mimetype: string;
    size: number;
  },
  userId?: string
): Promise<ApplicationDocument> {
  await ensureUploadDir();
  
  // Generate unique filename
  const fileExtension = path.extname(file.name);
  const uniqueName = `${applicationId}_${documentType}_${Date.now()}${fileExtension}`;
  const filePath = path.join(UPLOAD_DIR, uniqueName);
  
  // Save file to disk
  await fs.writeFile(filePath, file.data);
  
  // Save document record
  const documentData = {
    id: uuidv4(),
    application_id: applicationId,
    document_type: documentType,
    file_name: file.name,
    file_path: filePath,
    file_size: file.size.toString(),
    mime_type: file.mimetype,
    verification_status: VerificationStatus.PENDING,
    uploaded_by: userId
  };
  
  const [document] = await db('application_documents')
    .insert(documentData)
    .returning('*');
  
  return document;
}

/**
 * Get all documents for an application
 */
export async function getApplicationDocuments(applicationId: string): Promise<ApplicationDocument[]> {
  return await db('application_documents')
    .where({ application_id: applicationId })
    .orderBy('created_at', 'desc');
}

/**
 * Get document by ID. When `tenantId` is supplied the document is scoped to
 * that tenant via its parent application (admission_applications.tenant_id), so
 * the service is safe on its own and never returns another school's document.
 */
export async function getDocumentById(id: string, tenantId?: string): Promise<ApplicationDocument | null> {
  const query = db('application_documents').where({ 'application_documents.id': id });
  if (tenantId) {
    query
      .join('admission_applications', 'application_documents.application_id', 'admission_applications.id')
      .where('admission_applications.tenant_id', tenantId)
      .select('application_documents.*');
  }
  const document = await query.first();
  return document || null;
}

/**
 * Verify a document. Tenant-scoped when `tenantId` is provided (won't touch a
 * document belonging to another school).
 */
export async function verifyDocument(
  id: string,
  status: VerificationStatus,
  notes?: string,
  userId?: string,
  tenantId?: string,
): Promise<ApplicationDocument | null> {
  // Guard: if a tenant is given, ensure the document belongs to it first.
  if (tenantId) {
    const owned = await getDocumentById(id, tenantId);
    if (!owned) return null;
  }
  const [document] = await db('application_documents')
    .where({ id })
    .update({
      verification_status: status,
      verified_by: userId,
      verified_at: new Date(),
      verification_notes: notes,
      updated_at: new Date()
    })
    .returning('*');
  
  return document || null;
}

/**
 * Delete a document. Tenant-scoped when `tenantId` is provided.
 */
export async function deleteDocument(id: string, tenantId?: string): Promise<boolean> {
  const document = await getDocumentById(id, tenantId);
  if (!document) {
    return false;
  }
  
  // Delete file from disk
  if (document.file_path) {
    try {
      await fs.unlink(document.file_path);
    } catch (error) {
      console.error('Error deleting file:', error);
    }
  }
  
  // Delete record from database
  const deleted = await db('application_documents')
    .where({ id })
    .delete();
  
  return deleted > 0;
}

/**
 * Get document file path
 */
export async function getDocumentFilePath(id: string): Promise<string | null> {
  const document = await getDocumentById(id);
  return document?.file_path || null;
}

/**
 * Check if all required documents are uploaded and verified
 */
export async function checkDocumentCompleteness(
  applicationId: string,
  requiredDocuments: DocumentType[]
): Promise<{
  complete: boolean;
  missing: DocumentType[];
  unverified: DocumentType[];
}> {
  const documents = await getApplicationDocuments(applicationId);
  
  const uploadedTypes = new Set(documents.map(d => d.document_type));
  const verifiedTypes = new Set(
    documents
      .filter(d => d.verification_status === VerificationStatus.VERIFIED)
      .map(d => d.document_type)
  );
  
  const missing = requiredDocuments.filter(type => !uploadedTypes.has(type));
  const unverified = requiredDocuments.filter(
    type => uploadedTypes.has(type) && !verifiedTypes.has(type)
  );
  
  return {
    complete: missing.length === 0 && unverified.length === 0,
    missing,
    unverified
  };
}

/**
 * Get documents pending verification
 */
export async function getPendingVerificationDocuments(): Promise<ApplicationDocument[]> {
  return await db('application_documents')
    .where({ verification_status: VerificationStatus.PENDING })
    .orderBy('created_at', 'asc');
}
