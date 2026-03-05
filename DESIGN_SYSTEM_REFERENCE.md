# Mobile UI Design System - Quick Reference

## CSS Variables Quick Lookup

### Colors
```css
/* Primary Colors */
--primary: #2563eb          /* Blue - use for main actions */
--primary-dark: #1e40af     /* Darker blue - hover states */
--primary-light: #3b82f6    /* Lighter blue - backgrounds */

/* Status Colors */
--success: #10b981          /* Green - positive states */
--danger: #ef4444           /* Red - errors, delete actions */
--warning: #f59e0b          /* Amber - warnings, caution */

/* Neutral Colors */
--bg-primary: #ffffff       /* Main background */
--bg-secondary: #f9fafb     /* Section backgrounds */
--bg-tertiary: #f3f4f6      /* Card/hover backgrounds */
--text-primary: #111827     /* Main text */
--text-secondary: #6b7280   /* Secondary text */
--text-light: #9ca3af       /* Disabled, placeholder text */
--border: #e5e7eb           /* Main borders */
--border-light: #f3f4f6     /* Subtle borders */
```

### Spacing
```css
/* Use in margin, padding, gap */
--space-xs: 4px
--space-sm: 8px
--space-md: 12px
--space-lg: 16px
--space-xl: 24px
--space-2xl: 32px
--space-3xl: 48px
--space-4xl: 64px
```

### Shadows
```css
--shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05)
--shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1)
--shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1)
--shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.1)
--shadow-2xl: 0 25px 50px -12px rgba(0, 0, 0, 0.25)
```

### Border Radius
```css
--radius-sm: 4px
--radius-md: 8px
--radius-lg: 12px      /* Default for cards */
--radius-xl: 16px      /* Large elements */
--radius-full: 9999px  /* Circles, pills */
```

### Transitions
```css
--transition-fast: 150ms ease    /* Quick interactions */
--transition-base: 200ms ease    /* Standard transitions */
--transition-slow: 300ms ease    /* Major changes */
```

## Common Component Patterns

### Button
```css
.btn-primary {
  background: var(--primary);
  color: white;
  padding: var(--space-md) var(--space-lg);
  border-radius: var(--radius-lg);
  min-height: 44px;  /* Touch target */
  transition: all var(--transition-fast);
}

.btn-primary:hover {
  background: var(--primary-dark);
  box-shadow: var(--shadow-md);
  transform: translateY(-2px);
}
```

### Card
```css
.card {
  background: var(--bg-primary);
  border-radius: var(--radius-lg);
  padding: var(--space-lg);
  box-shadow: var(--shadow-sm);
  border: 1px solid var(--border-light);
  transition: all var(--transition-base);
}

.card:hover {
  box-shadow: var(--shadow-md);
  transform: translateY(-2px);
}
```

### Form Input
```css
input, textarea {
  width: 100%;
  padding: var(--space-md) var(--space-lg);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  font-size: 16px;
  transition: all var(--transition-fast);
}

input:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
}
```

### Badge
```css
.badge {
  display: inline-flex;
  align-items: center;
  padding: 4px 12px;
  border-radius: var(--radius-full);
  font-size: 12px;
  font-weight: 600;
}

.badge.success {
  background: rgba(16, 185, 129, 0.1);
  color: var(--success);
}
```

## Responsive Breakpoints

```css
/* Mobile First */
/* Base styles for mobile (320px - 547px) */

/* Tablet (548px+) */
@media (min-width: 548px) {
  /* Tablet optimizations */
}

/* Desktop (768px+) */
@media (min-width: 768px) {
  /* Show desktop navigation */
  /* Expand grids to 2-3 columns */
}

/* Large Desktop (1024px+) */
@media (min-width: 1024px) {
  /* Full layouts */
  /* 3-4 column grids */
}
```

## Mobile-First Template

```css
/* 1. Base mobile styles */
.component {
  padding: var(--space-lg);
  display: grid;
  grid-template-columns: 1fr;
}

/* 2. Tablet adjustments */
@media (min-width: 548px) {
  .component {
    grid-template-columns: repeat(2, 1fr);
    padding: var(--space-xl);
  }
}

/* 3. Desktop adjustments */
@media (min-width: 768px) {
  .component {
    grid-template-columns: repeat(3, 1fr);
    padding: var(--space-2xl);
  }
}

/* 4. Large desktop */
@media (min-width: 1024px) {
  .component {
    grid-template-columns: repeat(4, 1fr);
  }
}
```

## Touch & Interaction Guidelines

### Button Sizes
```css
/* Minimum touch targets: 44x44px */
button {
  min-height: 44px;
  min-width: 44px;
  padding: var(--space-md) var(--space-lg);
}

/* Icon buttons: Square 44x44px */
.icon-btn {
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
}
```

### Form Input Sizing
```css
/* Use 16px font to prevent iOS auto-zoom */
input, textarea, select {
  font-size: 16px;  /* Critical for mobile */
  padding: var(--space-md) var(--space-lg);
  /* Minimum height: 44px for touch */
}
```

### Hover States
```css
/* Subtle, not intrusive */
.interactive:hover {
  background: var(--bg-secondary);
  transform: translateY(-2px);
  transition: all var(--transition-fast);
}

/* Active/pressed state */
.interactive:active {
  transform: translateY(0);
}
```

## Grid Layouts

### Single Column Mobile
```css
.grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--space-lg);
}
```

### Two Column Tablet
```css
@media (min-width: 548px) {
  .grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
```

### Three Column Desktop
```css
@media (min-width: 768px) {
  .grid {
    grid-template-columns: repeat(3, 1fr);
  }
}
```

## Do's and Don'ts

### ✅ DO
- Use CSS variables for all colors and spacing
- Mobile-first approach (base > tablet > desktop)
- Test on actual mobile devices
- Use 16px for form inputs
- 44x44px minimum touch targets
- Provide visual feedback on interactions
- Use appropriate font sizes (14px min on mobile)

### ❌ DON'T
- Hardcode colors or spacing values
- Use desktop-first media queries
- Assume desktop browser behavior
- Use small font sizes on mobile
- Forgot about touch interactions
- Ignore hover states
- Create long unbroken text lines
- Ignore landscape orientation

## Color Contrast Check
```
WCAG AA Compliant:
- Text on bg: 4.5:1 ratio
- Large text: 3:1 ratio
- Interactive elements: 3:1 ratio

Examples:
✅ Dark text (#111827) on light bg (#ffffff) = 18:1
✅ Medium text (#6b7280) on light bg (#f9fafb) = 10:1
✅ Blue (#2563eb) on white = 8.59:1
```

## Typography Scale

```css
/* Mobile */
h1: 28px, 700 weight
h2: 24px, 600 weight
h3: 20px, 600 weight
h4: 16px, 600 weight
body: 14px minimum (usually 16px)
small: 12px

/* Tablet (548px+) */
h1: 32px
h2: 28px
h3: 22px

/* Desktop (768px+) */
h1: 36px
h2: 30px
h3: 24px

/* Large Desktop (1024px+) */
h1: 40-48px
h2: 32px
```

## Quick Start Example

```html
<!-- HTML -->
<div class="card">
  <h2 class="card-title">My Card</h2>
  <p class="card-text">Card content here</p>
  <button class="btn-primary">Action</button>
</div>
```

```css
/* CSS using design system */
.card {
  background: var(--bg-primary);
  border-radius: var(--radius-lg);
  padding: var(--space-lg);
  box-shadow: var(--shadow-sm);
  border: 1px solid var(--border-light);
  margin-bottom: var(--space-lg);
}

.card-title {
  font-size: 20px;
  font-weight: 600;
  margin-bottom: var(--space-md);
  color: var(--text-primary);
}

.card-text {
  color: var(--text-secondary);
  margin-bottom: var(--space-lg);
  line-height: var(--lh-normal);
}

.btn-primary {
  background: var(--primary);
  color: white;
  padding: var(--space-md) var(--space-lg);
  border-radius: var(--radius-lg);
  border: none;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.btn-primary:hover {
  background: var(--primary-dark);
  box-shadow: var(--shadow-md);
}
```

---

**For more details, see [MOBILE_UI_IMPROVEMENTS.md](./MOBILE_UI_IMPROVEMENTS.md)**