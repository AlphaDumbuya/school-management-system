/**
 * CategorySelector Component
 * Multi-select categories with visual indicators
 * Task 5.10
 */

import React, { useEffect, useState } from 'react';
import { Button } from '@components/ui/button';
import { eventsService } from '@services/eventsService';
import { EventCategory, CategorySelectorProps } from '@appTypes/events';
import { toast } from 'react-toastify';

export const CategorySelector: React.FC<CategorySelectorProps> = ({
    selected = [],
    onChange,
    allowCreate = false,
}) => {
    const [categories, setCategories] = useState<EventCategory[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [newCategory, setNewCategory] = useState({ name: '', color: '#3B82F6' });

    useEffect(() => {
        fetchCategories();
    }, []);

    const fetchCategories = async () => {
        setLoading(true);
        const response = await eventsService.listCategories();
        if (response.success && response.data) {
            setCategories(response.data);
        } else {
            toast.error('Failed to load categories');
        }
        setLoading(false);
    };

    const handleToggle = (categoryId: string) => {
        if (selected.includes(categoryId)) {
            onChange(selected.filter((id) => id !== categoryId));
        } else {
            onChange([...selected, categoryId]);
        }
    };

    const handleCreate = async () => {
        if (!newCategory.name.trim()) {
            toast.error('Category name is required');
            return;
        }

        const response = await eventsService.createCategory(newCategory);
        if (response.success && response.data) {
            toast.success('Category created successfully');
            setCategories([...categories, response.data]);
            setNewCategory({ name: '', color: '#3B82F6' });
            setShowCreateForm(false);
            onChange([...selected, response.data.category_id]);
        } else {
            toast.error(response.error || 'Failed to create category');
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-gray-700">Categories</label>
                {allowCreate && (
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowCreateForm(!showCreateForm)}
                    >
                        {showCreateForm ? 'Cancel' : '+ New Category'}
                    </Button>
                )}
            </div>

            {showCreateForm && (
                <div className="bg-gray-50 p-4 rounded-lg space-y-3">
                    <input
                        type="text"
                        placeholder="Category name"
                        value={newCategory.name}
                        onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <div className="flex items-center gap-2">
                        <input
                            type="color"
                            value={newCategory.color}
                            onChange={(e) => setNewCategory({ ...newCategory, color: e.target.value })}
                            className="h-10 w-20 rounded cursor-pointer"
                        />
                        <Button type="button" onClick={handleCreate} size="sm">
                            Create
                        </Button>
                    </div>
                </div>
            )}

            <div className="flex flex-wrap gap-2">
                {categories.length === 0 ? (
                    <p className="text-sm text-gray-500">No categories available</p>
                ) : (
                    categories.map((category) => {
                        const isSelected = selected.includes(category.category_id);
                        return (
                            <button
                                key={category.category_id}
                                type="button"
                                onClick={() => handleToggle(category.category_id)}
                                className={`
                  inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium
                  transition-all duration-150
                  ${isSelected
                                        ? 'ring-2 ring-offset-2 shadow-md'
                                        : 'hover:shadow-md opacity-60 hover:opacity-100'
                                    }
                `}
                                style={{
                                    backgroundColor: category.color || '#3B82F6',
                                    color: '#FFFFFF',
                                    ringColor: category.color || '#3B82F6',
                                }}
                            >
                                {category.icon && <span>{category.icon}</span>}
                                <span>{category.name}</span>
                                {isSelected && <span>✓</span>}
                            </button>
                        );
                    })
                )}
            </div>

            {selected.length > 0 && (
                <div className="text-sm text-gray-600">
                    {selected.length} {selected.length === 1 ? 'category' : 'categories'} selected
                </div>
            )}
        </div>
    );
};

export default CategorySelector;
