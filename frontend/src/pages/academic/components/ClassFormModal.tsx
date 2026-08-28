/**
 * ClassFormModal — Add / Edit class
 * Multi-step cascading level selector for Sierra Leone education system.
 * - xl modal size — spacious on desktop, full-sheet on mobile
 * - Auto-prefills class name as user selects level + stream
 * - Smart smooth-scroll to newly revealed sections
 * - Fully responsive cards with consistent spacing across all breakpoints
 */

import React, { useEffect, useMemo, useRef, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ChevronRight, Check } from 'lucide-react';
import { Modal } from '@components/admin/feedback/Modal';
import { Button } from '@components/ui/button';
import { FormField } from '@components/admin/forms/FormField';
import { showToast } from '@utils/toast';
import { classesService, ClassRecord, ClassFormData } from '@services/classesService';

// ── Sierra Leone Education Structure ──────────────────────────────────────────

type Category = 'nursery' | 'primary' | 'secondary';
type SubCategory = 'jss' | 'sss';

const LEVELS = [
  'NURSERY1', 'NURSERY2', 'NURSERY3',
  'CLASS1', 'CLASS2', 'CLASS3', 'CLASS4', 'CLASS5', 'CLASS6',
  'JSS1', 'JSS2', 'JSS3',
  'SSS1', 'SSS2', 'SSS3',
] as const;

type Level = typeof LEVELS[number];

const LEVEL_NAMES: Record<string, string> = {
  NURSERY1: 'Nursery 1', NURSERY2: 'Nursery 2', NURSERY3: 'Nursery 3',
  CLASS1: 'Class 1', CLASS2: 'Class 2', CLASS3: 'Class 3',
  CLASS4: 'Class 4', CLASS5: 'Class 5', CLASS6: 'Class 6',
  JSS1: 'JSS 1', JSS2: 'JSS 2', JSS3: 'JSS 3',
  SSS1: 'SSS 1', SSS2: 'SSS 2', SSS3: 'SSS 3',
};

const CATEGORIES: { value: Category; label: string; description: string; icon: string }[] = [
  { value: 'nursery', label: 'Nursery', description: 'Ages 3–5 · 3 years', icon: '💒' },
  { value: 'primary', label: 'Primary', description: 'Ages 6–11 · 6 years', icon: '📚' },
  { value: 'secondary', label: 'Secondary', description: 'Ages 12–17 · 6 years', icon: '🎓' },
];

const SUB_CATEGORIES: { value: SubCategory; label: string; description: string }[] = [
  { value: 'jss', label: 'Junior Secondary (JSS)', description: '3 years · BECE examination' },
  { value: 'sss', label: 'Senior Secondary (SSS)', description: '3 years · WASSCE examination' },
];

const NURSERY_LEVELS: Level[] = ['NURSERY1', 'NURSERY2', 'NURSERY3'];
const PRIMARY_LEVELS: Level[] = ['CLASS1', 'CLASS2', 'CLASS3', 'CLASS4', 'CLASS5', 'CLASS6'];
const JSS_LEVELS: Level[] = ['JSS1', 'JSS2', 'JSS3'];
const SSS_LEVELS_LIST: Level[] = ['SSS1', 'SSS2', 'SSS3'];

const SSS_STREAMS = [
  { value: 'Science', label: 'Science', description: 'Physics, Chemistry, Biology, Further Maths' },
  { value: 'Arts', label: 'Arts / Humanities', description: 'Literature, History, Government, CRS/IRS' },
  { value: 'Commercial', label: 'Commercial / Business', description: 'Accounting, Commerce, Economics, Business Studies' },
  { value: 'Technical', label: 'Technical / Vocational', description: 'Technical Drawing, Woodwork, Metalwork, Electronics' },
] as const;

function getCategoryFromLevel(level: string): Category | null {
  if (level.startsWith('NURSERY')) return 'nursery';
  if (level.startsWith('CLASS')) return 'primary';
  if (level.startsWith('JSS') || level.startsWith('SSS')) return 'secondary';
  return null;
}

function getSubCategoryFromLevel(level: string): SubCategory | null {
  if (level.startsWith('JSS')) return 'jss';
  if (level.startsWith('SSS')) return 'sss';
  return null;
}

// ── Validation ────────────────────────────────────────────────────────────────

const schema = z.object({
  name:        z.string().min(1, 'Class name is required').max(50, 'Max 50 characters'),
  level:       z.enum(LEVELS, { required_error: 'Level is required' }),
  section:     z.string().optional(),
  capacity:    z.coerce.number().min(5, 'Minimum capacity is 5').max(100, 'Maximum capacity is 100'),
  room_number: z.string().optional(),
  floor:       z.string().optional(),
  building:    z.string().optional(),
  next_class_id: z.string().optional(),
  is_final_year: z.boolean().optional(),
});

type FormValues = z.infer<typeof schema>;

// ── Props ─────────────────────────────────────────────────────────────────────

interface ClassFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editingClass?: ClassRecord | null;
}

// ── Component ─────────────────────────────────────────────────────────────────

export const ClassFormModal: React.FC<ClassFormModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  editingClass,
}) => {
  const isEditing = !!editingClass;
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [allClasses, setAllClasses] = React.useState<ClassRecord[]>([]);

  // Load classes for the "next class" (promotion target) dropdown.
  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    classesService.listClasses({ limit: 200 })
      .then((res: any) => { if (active) setAllClasses(res?.data ?? []); })
      .catch(() => { /* non-fatal */ });
    return () => { active = false; };
  }, [isOpen]);

  // Cascading selector state
  const [category, setCategory] = React.useState<Category | null>(null);
  const [subCategory, setSubCategory] = React.useState<SubCategory | null>(null);

  // Refs for smart scrolling
  const subCategoryRef = useRef<HTMLDivElement>(null);
  const yearRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<HTMLDivElement>(null);
  const detailsRef = useRef<HTMLDivElement>(null);

  /** Smoothly scroll element into view after animation renders */
  const scrollToRef = useCallback((ref: React.RefObject<HTMLDivElement | null>) => {
    setTimeout(() => {
      ref.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 100);
  }, []);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '', level: undefined, section: '', capacity: 30,
      room_number: '', floor: '', building: '',
      next_class_id: '', is_final_year: false,
    },
  });

  const selectedLevel = watch('level');
  const selectedSection = watch('section');
  const isSSS = selectedLevel?.startsWith('SSS');

  // ── Auto-prefill class name ──
  useEffect(() => {
    if (!selectedLevel) return;
    const levelLabel = LEVEL_NAMES[selectedLevel] || selectedLevel;
    const autoName = selectedSection ? `${levelLabel} ${selectedSection}` : levelLabel;
    const currentName = watch('name');

    // Only auto-fill if name is empty or matches a known auto-generated pattern
    const isAutoGenerated = !currentName || LEVELS.some((l) => {
      const lbl = LEVEL_NAMES[l];
      return currentName === lbl || currentName.startsWith(lbl + ' ');
    });

    if (isAutoGenerated) {
      setValue('name', autoName);
    }
  }, [selectedLevel, selectedSection, setValue, watch]);

  // Pre-populate when editing
  useEffect(() => {
    if (isOpen && editingClass) {
      reset({
        name: editingClass.name,
        level: editingClass.level as any,
        section: editingClass.section ?? '',
        capacity: editingClass.capacity,
        room_number: editingClass.room_number ?? '',
        floor: editingClass.floor ?? '',
        building: editingClass.building ?? '',
        next_class_id: (editingClass.next_class_id as any) ?? '',
        is_final_year: !!editingClass.is_final_year,
      });
      const cat = getCategoryFromLevel(editingClass.level);
      setCategory(cat);
      setSubCategory(cat === 'secondary' ? getSubCategoryFromLevel(editingClass.level) : null);
    } else if (isOpen && !editingClass) {
      reset({ name: '', level: undefined, section: '', capacity: 30, room_number: '', floor: '', building: '', next_class_id: '', is_final_year: false });
      setCategory(null);
      setSubCategory(null);
    }
    setServerError(null);
  }, [isOpen, editingClass, reset]);

  // ── Handlers with smart scroll ──
  const handleCategorySelect = (cat: Category) => {
    setCategory(cat);
    setSubCategory(null);
    setValue('level', undefined as any);
    setValue('section', '');
    setValue('name', '');
    if (cat === 'secondary') {
      scrollToRef(subCategoryRef);
    } else {
      scrollToRef(yearRef);
    }
  };

  const handleSubCategorySelect = (sub: SubCategory) => {
    setSubCategory(sub);
    setValue('level', undefined as any);
    setValue('section', '');
    setValue('name', '');
    scrollToRef(yearRef);
  };

  const handleLevelSelect = (level: Level) => {
    setValue('level', level);
    if (!level.startsWith('SSS')) {
      const sssStreams = SSS_STREAMS.map((s) => s.value);
      if (selectedSection && sssStreams.includes(selectedSection as any)) {
        setValue('section', '');
      }
      scrollToRef(detailsRef);
    } else {
      scrollToRef(streamRef);
    }
  };

  const handleStreamSelect = (stream: string) => {
    setValue('section', stream);
    scrollToRef(detailsRef);
  };

  // Available levels based on cascading state
  const availableLevels = useMemo((): Level[] => {
    if (category === 'nursery') return NURSERY_LEVELS;
    if (category === 'primary') return PRIMARY_LEVELS;
    if (category === 'secondary') {
      if (subCategory === 'jss') return JSS_LEVELS;
      if (subCategory === 'sss') return SSS_LEVELS_LIST;
      return [];
    }
    return [];
  }, [category, subCategory]);

  // Submit
  const onSubmit = async (values: FormValues) => {
    setServerError(null);
    setIsSubmitting(true);
    try {
      const payload: ClassFormData = {
        name: values.name,
        level: values.level,
        section: values.section || undefined,
        capacity: values.capacity,
        room_number: values.room_number || undefined,
        floor: values.floor || undefined,
        building: values.building || undefined,
        next_class_id: values.is_final_year ? null : (values.next_class_id || null),
        is_final_year: !!values.is_final_year,
      };

      if (isEditing && editingClass) {
        const res = await classesService.updateClass(editingClass.id, payload);
        if (res.success === false) throw new Error(res.error ?? 'Update failed');
        showToast.saved('Class');
      } else {
        const res = await classesService.createClass(payload);
        if (res.success === false) throw new Error(res.error ?? 'Create failed');
        showToast.saved('Class');
      }
      onSuccess();
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong.';
      setServerError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Breadcrumb trail
  const breadcrumb = useMemo(() => {
    const parts: string[] = [];
    if (category) parts.push(CATEGORIES.find((c) => c.value === category)?.label ?? '');
    if (subCategory) parts.push(SUB_CATEGORIES.find((s) => s.value === subCategory)?.label ?? '');
    if (selectedLevel) parts.push(LEVEL_NAMES[selectedLevel] ?? '');
    if (isSSS && selectedSection) parts.push(selectedSection);
    return parts;
  }, [category, subCategory, selectedLevel, isSSS, selectedSection]);

  // ── Shared card styles ──
  const cardBase = 'relative rounded-xl border-2 transition-all duration-200 cursor-pointer select-none';
  const cardActive = 'border-blue-500 bg-blue-50 dark:bg-blue-950/30 shadow-md ring-1 ring-blue-500/20';
  const cardInactive = 'border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-700 hover:bg-gray-50 dark:hover:bg-gray-800/50 hover:shadow-sm active:scale-[0.98]';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Edit Class' : 'Add New Class'}
      size="xl"
      footer={
        <div className="flex items-center justify-between w-full gap-3">
          {/* Status hint */}
          <div className="hidden sm:block text-xs text-gray-400 dark:text-gray-500">
            {!selectedLevel && 'Select a level to continue'}
            {selectedLevel && isSSS && !selectedSection && 'Select a stream to continue'}
            {selectedLevel && (!isSSS || selectedSection) && 'Ready to create'}
          </div>
          <div className="flex items-center gap-3 ml-auto">
            <Button variant="ghost" disabled={isSubmitting} onClick={onClose}>
              Cancel
            </Button>
            <Button
              variant="default"
              disabled={isSubmitting || !selectedLevel}
              onClick={handleSubmit(onSubmit)}
            >
              {isSubmitting ? 'Saving…' : isEditing ? 'Save Changes' : 'Create Class'}
            </Button>
          </div>
        </div>
      }
    >
      {serverError && (
        <div className="mb-5 p-3.5 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-700 dark:text-red-400">
          {serverError}
        </div>
      )}

      <form className="flex flex-col gap-7">

        {/* ═══════════════════════════════════════════════════════════════════
            SECTION 1: LEVEL & STREAM
           ═══════════════════════════════════════════════════════════════════ */}
        <section>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-5">
            <h3 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-widest">
              Level & Stream
            </h3>
            {breadcrumb.length > 0 && (
              <div className="flex items-center gap-1.5 text-xs flex-wrap">
                {breadcrumb.map((part, i) => (
                  <React.Fragment key={i}>
                    {i > 0 && <ChevronRight size={10} className="text-gray-300 dark:text-gray-600 flex-shrink-0" />}
                    <span className="font-semibold text-blue-600 dark:text-blue-400 whitespace-nowrap">{part}</span>
                  </React.Fragment>
                ))}
              </div>
            )}
          </div>

          {/* ── Step 1: Category ── */}
          <div className="mb-5">
            <p className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">
              1. School Level
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.value}
                  type="button"
                  onClick={() => handleCategorySelect(cat.value)}
                  className={`${cardBase} ${category === cat.value ? cardActive : cardInactive}
                    flex items-center gap-3 p-4
                    sm:flex-col sm:items-center sm:text-center sm:p-5 sm:py-6`}
                >
                  {category === cat.value && (
                    <div className="absolute top-2.5 right-2.5">
                      <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center shadow-sm">
                        <Check size={12} className="text-white" strokeWidth={3} />
                      </div>
                    </div>
                  )}
                  <span className="text-2xl sm:text-4xl flex-shrink-0">{cat.icon}</span>
                  <div className="sm:mt-2 min-w-0">
                    <span className={`block text-sm sm:text-base font-bold leading-tight ${
                      category === cat.value ? 'text-blue-700 dark:text-blue-400' : 'text-gray-800 dark:text-gray-200'
                    }`}>
                      {cat.label}
                    </span>
                    <span className="block text-[11px] sm:text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-snug">
                      {cat.description}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* ── Step 2: Sub-category (Secondary only) ── */}
          {category === 'secondary' && (
            <div ref={subCategoryRef} className="mb-5 animate-in fade-in slide-in-from-top-1 duration-200">
              <p className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">
                2. Secondary Type
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                {SUB_CATEGORIES.map((sub) => (
                  <button
                    key={sub.value}
                    type="button"
                    onClick={() => handleSubCategorySelect(sub.value)}
                    className={`${cardBase} ${subCategory === sub.value ? cardActive : cardInactive}
                      flex items-start gap-3 p-4 sm:p-5 text-left`}
                  >
                    {subCategory === sub.value && (
                      <div className="absolute top-2.5 right-2.5">
                        <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center shadow-sm">
                          <Check size={12} className="text-white" strokeWidth={3} />
                        </div>
                      </div>
                    )}
                    <div className="flex-1 min-w-0 pr-7">
                      <span className={`block text-sm font-bold ${
                        subCategory === sub.value ? 'text-blue-700 dark:text-blue-400' : 'text-gray-800 dark:text-gray-200'
                      }`}>
                        {sub.label}
                      </span>
                      <span className="block text-xs text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
                        {sub.description}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Step 3: Year / Grade ── */}
          {availableLevels.length > 0 && (
            <div ref={yearRef} className="mb-5 animate-in fade-in slide-in-from-top-1 duration-200">
              <p className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">
                {category === 'secondary' ? '3. Year' : '2. Year / Grade'}
              </p>
              <div className="flex flex-wrap gap-2 sm:gap-3">
                {availableLevels.map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => handleLevelSelect(lvl)}
                    className={`${cardBase} ${selectedLevel === lvl ? cardActive : cardInactive}
                      px-4 sm:px-5 py-2.5 sm:py-3 text-sm font-bold min-w-[72px] sm:min-w-[88px] text-center`}
                  >
                    {LEVEL_NAMES[lvl]}
                  </button>
                ))}
              </div>
              {errors.level && (
                <p className="text-xs text-red-600 dark:text-red-400 mt-2">{errors.level.message}</p>
              )}
            </div>
          )}

          {/* ── Step 4: Stream (SSS only) ── */}
          {isSSS && selectedLevel && (
            <div ref={streamRef} className="mb-2 animate-in fade-in slide-in-from-top-1 duration-200">
              <p className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">
                4. Stream
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                {SSS_STREAMS.map((stream) => (
                  <button
                    key={stream.value}
                    type="button"
                    onClick={() => handleStreamSelect(stream.value)}
                    className={`${cardBase} ${selectedSection === stream.value ? cardActive : cardInactive}
                      flex flex-col items-start gap-1.5 p-4 sm:p-5 text-left`}
                  >
                    {selectedSection === stream.value && (
                      <div className="absolute top-2.5 right-2.5">
                        <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center shadow-sm">
                          <Check size={12} className="text-white" strokeWidth={3} />
                        </div>
                      </div>
                    )}
                    <span className={`text-sm font-bold pr-7 ${
                      selectedSection === stream.value ? 'text-blue-700 dark:text-blue-400' : 'text-gray-800 dark:text-gray-200'
                    }`}>
                      {stream.label}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                      {stream.description}
                    </span>
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-2.5 leading-relaxed">
                Streams follow the WASSCE curriculum for Sierra Leone senior secondary schools.
              </p>
            </div>
          )}

          {/* Section input for non-SSS levels */}
          {selectedLevel && !isSSS && (
            <div className="animate-in fade-in slide-in-from-top-1 duration-200">
              <FormField
                label="Section (Optional)"
                placeholder="e.g. A, B, C"
                helperText="Use letters for multiple arms of this level (e.g. JSS 1A, JSS 1B)"
                error={errors.section?.message}
                {...register('section')}
              />
            </div>
          )}
        </section>

        {/* ═══════════════════════════════════════════════════════════════════
            SECTION 2: CLASS DETAILS
           ═══════════════════════════════════════════════════════════════════ */}
        {selectedLevel && (
          <section ref={detailsRef} className="animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="border-t border-gray-100 dark:border-gray-800 pt-6">
              <h3 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-widest mb-4">
                Class Details
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
                <FormField
                  label="Class Name"
                  placeholder="e.g. SSS 2 Science"
                  required
                  helperText="Auto-filled from selections. You can customise it."
                  error={errors.name?.message}
                  {...register('name')}
                />
                <FormField
                  label="Capacity"
                  type="number"
                  placeholder="30"
                  required
                  helperText="Max students (5–100)"
                  error={errors.capacity?.message}
                  {...register('capacity')}
                />
              </div>
            </div>
          </section>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            SECTION 3: LOCATION (Optional)
           ═══════════════════════════════════════════════════════════════════ */}
        {selectedLevel && (
          <section className="animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="border-t border-gray-100 dark:border-gray-800 pt-6">
              <div className="mb-4">
                <h3 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-widest">
                  Location
                </h3>
                <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">
                  Optional — helps with timetabling and room assignments
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5">
                <FormField
                  label="Room Number"
                  placeholder="e.g. R101"
                  error={errors.room_number?.message}
                  {...register('room_number')}
                />
                <FormField
                  label="Floor"
                  placeholder="e.g. Ground Floor"
                  error={errors.floor?.message}
                  {...register('floor')}
                />
                <FormField
                  label="Building"
                  placeholder="e.g. Main Block"
                  error={errors.building?.message}
                  {...register('building')}
                />
              </div>

              {/* Promotion mapping — used for automatic end-of-year promotion */}
              <div className="mt-6 pt-5 border-t border-gray-200 dark:border-gray-700">
                <h3 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-widest">
                  Promotion
                </h3>
                <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5 mb-3">
                  Where students go when they pass at year-end. Required for automatic promotion on result release.
                </p>

                <label className="flex items-center gap-2 mb-3 cursor-pointer select-none">
                  <input type="checkbox" {...register('is_final_year')} className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                  <span className="text-sm text-gray-700 dark:text-gray-300">This is a final year — passing students <b>graduate</b></span>
                </label>

                {!watch('is_final_year') && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Next Class (on promotion)</label>
                    <select
                      {...register('next_class_id')}
                      className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">— Not set (manual promotion only) —</option>
                      {allClasses
                        .filter((c) => String(c.id) !== String(editingClass?.id))
                        .map((c) => (
                          <option key={c.id} value={String(c.id)}>{c.name}{c.level ? ` (${c.level})` : ''}</option>
                        ))}
                    </select>
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {/* Hidden inputs for react-hook-form */}
        <input type="hidden" {...register('level')} />
        <input type="hidden" {...register('section')} />
      </form>
    </Modal>
  );
};

export default ClassFormModal;
