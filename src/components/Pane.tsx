import React, { useState } from 'react';
import type { ReactNode } from 'react';

interface PaneProps {
  title: string;
  children: ReactNode;
  defaultCollapsed?: boolean;
  actions?: ReactNode;
}

export const Pane: React.FC<PaneProps> = ({
  title,
  children,
  defaultCollapsed = false,
  actions,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);

  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
  };

  return (
    <div className={`collapsible-pane ${isCollapsed ? 'collapsed' : ''}`}>
      <div className="pane-header">
        <div className="pane-header-left">
          <button className="collapse-button" onClick={toggleCollapse}>
            {isCollapsed ? '▶' : '▼'}
          </button>
          <h3>{title}</h3>
        </div>
        {actions && <div className="pane-actions">{actions}</div>}
      </div>
      {!isCollapsed && <div className="pane-content">{children}</div>}
    </div>
  );
};
