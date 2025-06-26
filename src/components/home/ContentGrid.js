// Update your grid component to use the CSS module

import css from './Grid.module.less';

// In your component render function:
return (
  <div className={css.gridContainer}>
    {items.map((item) => (
      <div key={item.id} className={css.gridItem}>
        {/* Your item content */}
      </div>
    ))}
  </div>
);