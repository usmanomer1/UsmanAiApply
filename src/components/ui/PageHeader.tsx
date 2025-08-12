import React from 'react';
import { Link } from 'react-router-dom';

interface PageAction {
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  href?: string;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'dark' | 'ghost';
}

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  primaryAction?: PageAction;
  actions?: PageAction[];
}

const ActionButton: React.FC<{ action: PageAction }> = ({ action }) => {
  const { icon: Icon, href, onClick, label, variant = 'secondary' } = action;
  const base = 'inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors';
  const variants: Record<NonNullable<PageAction['variant']>, string> = {
    primary: 'bg-teal-600 text-white hover:bg-teal-700',
    secondary: 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50',
    dark: 'bg-black text-white hover:bg-gray-800',
    ghost: 'text-gray-700 hover:bg-gray-50',
  };
  const className = `${base} ${variants[variant]}`;

  if (href) {
    return (
      <Link to={href} className={className} onClick={onClick}>
        {Icon ? <Icon className="h-4 w-4" /> : null}
        {label}
      </Link>
    );
  }

  return (
    <button className={className} onClick={onClick}>
      {Icon ? <Icon className="h-4 w-4" /> : null}
      {label}
    </button>
  );
};

export const PageHeader: React.FC<PageHeaderProps> = ({ title, subtitle, primaryAction, actions }) => {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-amber-50 via-white to-teal-50 p-6 border border-gray-100 mb-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">{title}</h1>
          {subtitle ? <p className="text-gray-600 mt-1">{subtitle}</p> : null}
        </div>
        <div className="flex items-center gap-2">
          {actions?.map((a, i) => (
            <ActionButton key={`${a.label}-${i}`} action={a} />
          ))}
          {primaryAction ? <ActionButton action={{ ...primaryAction, variant: primaryAction.variant ?? 'primary' }} /> : null}
        </div>
      </div>
    </div>
  );
};

export default PageHeader;