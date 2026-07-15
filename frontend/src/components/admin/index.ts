// ── Layout ───────────────────────────────────────────────────────────────────
export { PageShell }    from './layout/PageShell';
export { PageHeader }   from './layout/PageHeader';
export { Breadcrumb }   from './layout/Breadcrumb';
export type { PageShellProps, TabItem as PageShellTabItem } from './layout/PageShell';
export type { PageHeaderProps } from './layout/PageHeader';
export type { BreadcrumbProps, BreadcrumbItem } from './layout/Breadcrumb';

// ── Table ────────────────────────────────────────────────────────────────────
export { DataTable }          from './table/DataTable';
export { ActionBar }          from './table/ActionBar';
export { SearchBar }          from './table/SearchBar';
export { BulkToolbar }        from './table/BulkToolbar';
export { MultiSelectFilter }  from './table/MultiSelectFilter';
export { DateRangePicker }    from './table/DateRangePicker';
export type { DataTableProps, RowAction, PaginationMode } from './table/DataTable';
export type { ActionBarProps, ActionBarFilter }            from './table/ActionBar';
export type { SearchBarProps }                             from './table/SearchBar';
export type { BulkToolbarProps, BulkAction }               from './table/BulkToolbar';
export type { MultiSelectFilterProps, MultiSelectOption }  from './table/MultiSelectFilter';
export type { DateRangePickerProps, DateRangeValue }        from './table/DateRangePicker';

// ── Forms ────────────────────────────────────────────────────────────────────
export { FormField }    from './forms/FormField';
export { FormSection }  from './forms/FormSection';
export type { FormFieldProps, FormFieldOption } from './forms/FormField';
export type { FormSectionProps }                from './forms/FormSection';

// ── Charts ───────────────────────────────────────────────────────────────────
export { ChartCard }  from './charts/ChartCard';
export type { ChartCardProps, ChartType, ChartSeries } from './charts/ChartCard';

// ── Feedback ─────────────────────────────────────────────────────────────────
export { Modal }               from './feedback/Modal';
export { ConfirmationDialog }  from './feedback/ConfirmationDialog';
export { EmptyState }          from './feedback/EmptyState';
export { ErrorState }          from './feedback/ErrorState';
export {
  Skeleton,
  SkeletonText,
  SkeletonCard,
  SkeletonTableRow,
  SkeletonChart,
}                              from './feedback/Skeleton';
export { StatusBadge }         from './feedback/StatusBadge';
export { ProgressBar }         from './feedback/ProgressBar';
export { AvatarGroup }         from './feedback/AvatarGroup';
export type { ModalProps, ModalSize }                     from './feedback/Modal';
export type { ConfirmationDialogProps }                    from './feedback/ConfirmationDialog';
export type { EmptyStateProps }                            from './feedback/EmptyState';
export type { ErrorStateProps }                            from './feedback/ErrorState';
export type { SkeletonProps, SkeletonTableRowProps, SkeletonChartProps } from './feedback/Skeleton';
export type { StatusBadgeProps }                           from './feedback/StatusBadge';
export type { ProgressBarProps, ProgressBarColor, ProgressBarSize } from './feedback/ProgressBar';
export type { AvatarGroupProps, AvatarItem }               from './feedback/AvatarGroup';

// ── Common ───────────────────────────────────────────────────────────────────
export { RoleGuard }   from './common/RoleGuard';
export { PageTabs }    from './common/PageTabs';
export type { RoleGuardProps }      from './common/RoleGuard';
export type { PageTabsProps, TabItem } from './common/PageTabs';

// ── Templates ────────────────────────────────────────────────────────────────
export { AdminPageTemplate }  from './templates/AdminPageTemplate';
export type { AdminPageTemplateProps } from './templates/AdminPageTemplate';
