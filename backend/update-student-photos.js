import knex from 'knex';
import knexfile from './knexfile.js';

const db = knex(knexfile.production);

async function updateStudentPhotos() {
  try {
    console.log('📸 Updating student photos with sample data...\n');
    
    // Get existing students first
    const existingStudents = await db('students').select('id', 'student_id', 'first_name', 'last_name', 'photo_url');
    console.log('Found existing students:', existingStudents.length);
    
    // Sample photos using placeholder services for real photos
    const samplePhotos = [
      'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=400&h=400&fit=crop&crop=face', // Woman
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop&crop=face', // Man
      'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&h=400&fit=crop&crop=face', // Woman 2
      'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&h=400&fit=crop&crop=face', // Man 2
      'https://images.unsplash.com/photo-1544725176-7c40e5a71c5e?w=400&h=400&fit=crop&crop=face', // Woman 3
    ];
    
    for (let i = 0; i < existingStudents.length; i++) {
      const student = existingStudents[i];
      const photoUrl = samplePhotos[i % samplePhotos.length];
      
      const result = await db('students')
        .where('id', student.id)
        .update({ photo_url: photoUrl });
        
      if (result > 0) {
        console.log(`✅ Updated photo for student: ${student.student_id} (${student.first_name} ${student.last_name})`);
      }
    }
    
    console.log('\n✨ Photo updates complete!');
    
    // Show updated students
    const updatedStudents = await db('students').select('student_id', 'first_name', 'last_name', 'photo_url');
    console.log('\n📊 Students with photos:');
    updatedStudents.forEach(s => {
      console.log(`  ${s.student_id} - ${s.first_name} ${s.last_name}: ${s.photo_url ? '✅ Has Photo' : '❌ No Photo'}`);
      if (s.photo_url) {
        console.log(`    Photo URL: ${s.photo_url.substring(0, 80)}${s.photo_url.length > 80 ? '...' : ''}`);
      }
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await db.destroy();
  }
}

updateStudentPhotos();