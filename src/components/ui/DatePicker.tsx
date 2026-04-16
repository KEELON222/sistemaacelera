import React, { useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import './DatePicker.css';

interface DatePickerProps {
    value: string;
    onChange: (date: string) => void;
    placeholder?: string;
}

const MONTHS_PT = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const WEEKDAYS_PT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export function DatePicker({ value, onChange, placeholder = 'Selecionar data' }: DatePickerProps) {
    const [isOpen, setIsOpen] = useState(false);
    const today = new Date();
    const selected = value ? new Date(value + 'T00:00:00') : null;
    const [viewMonth, setViewMonth] = useState(selected ? selected.getMonth() : today.getMonth());
    const [viewYear, setViewYear] = useState(selected ? selected.getFullYear() : today.getFullYear());
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const getDaysInMonth = (month: number, year: number) => new Date(year, month + 1, 0).getDate();
    const getFirstDayOfMonth = (month: number, year: number) => new Date(year, month, 1).getDay();

    const prevMonth = () => {
        if (viewMonth === 0) { setViewMonth(11); setViewYear(viewYear - 1); }
        else setViewMonth(viewMonth - 1);
    };

    const nextMonth = () => {
        if (viewMonth === 11) { setViewMonth(0); setViewYear(viewYear + 1); }
        else setViewMonth(viewMonth + 1);
    };

    const selectDate = (day: number) => {
        const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        onChange(dateStr);
        setIsOpen(false);
    };

    const clearDate = () => { onChange(''); setIsOpen(false); };

    const daysInMonth = getDaysInMonth(viewMonth, viewYear);
    const firstDay = getFirstDayOfMonth(viewMonth, viewYear);

    const days: (number | null)[] = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let d = 1; d <= daysInMonth; d++) days.push(d);

    const isToday = (day: number) => day === today.getDate() && viewMonth === today.getMonth() && viewYear === today.getFullYear();
    const isSelected = (day: number) => {
        if (!selected) return false;
        return day === selected.getDate() && viewMonth === selected.getMonth() && viewYear === selected.getFullYear();
    };

    const displayValue = selected
        ? selected.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
        : '';

    return (
        <div className="datepicker-container" ref={containerRef}>
            <div className="datepicker-trigger" onClick={() => setIsOpen(!isOpen)}>
                <Calendar size={16} className="datepicker-icon" />
                <span className={`datepicker-value ${!displayValue ? 'datepicker-placeholder' : ''}`}>
                    {displayValue || placeholder}
                </span>
            </div>

            {isOpen && (
                <div className="datepicker-dropdown">
                    <div className="datepicker-head">
                        <button className="datepicker-nav" onClick={prevMonth}><ChevronLeft size={16} /></button>
                        <span className="datepicker-month-label">{MONTHS_PT[viewMonth]} {viewYear}</span>
                        <button className="datepicker-nav" onClick={nextMonth}><ChevronRight size={16} /></button>
                    </div>

                    <div className="datepicker-weekdays">
                        {WEEKDAYS_PT.map(d => <span key={d} className="datepicker-weekday">{d}</span>)}
                    </div>

                    <div className="datepicker-grid">
                        {days.map((day, i) => (
                            <button
                                key={i}
                                className={`datepicker-day ${!day ? 'datepicker-empty' : ''} ${day && isToday(day) ? 'datepicker-today' : ''} ${day && isSelected(day) ? 'datepicker-selected' : ''}`}
                                onClick={() => day && selectDate(day)}
                                disabled={!day}
                            >
                                {day || ''}
                            </button>
                        ))}
                    </div>

                    <div className="datepicker-footer">
                        <button className="datepicker-footer-btn" onClick={clearDate}>Limpar</button>
                        <button className="datepicker-footer-btn datepicker-today-btn" onClick={() => selectDate(today.getDate())}>Hoje</button>
                    </div>
                </div>
            )}
        </div>
    );
}
