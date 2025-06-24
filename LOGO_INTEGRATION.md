# 🎨 Logo Integration Guide

## Logo Files Location
Your logo file is located at:
- **All modes:** `/public/images/logos/light.png`

## Logo Component Usage

### Import
```tsx
import { Logo } from '../ui/Logo';
// or
import { Logo } from '../ui';
```

### Basic Usage
```tsx
<Logo />
```

### With Custom Properties
```tsx
<Logo 
  width={120}           // Custom width (default: 120)
  height={40}           // Custom height (default: 40)
  className="my-class"  // Additional CSS classes
  onClick={handleClick} // Click handler (makes it clickable)
  alt="Custom Alt Text" // Custom alt text (default: "Jobotic Logo")
/>
```

## Current Implementation

### ✅ Integrated Locations:

1. **Navbar** (`/src/components/layout/Navbar.tsx`)
   - Main app navigation logo
   - Automatically switches between light/dark
   - Size: 40x40px with rounded corners

2. **Auth Page** (`/src/components/auth/AuthPage.tsx`)
   - Desktop branding section (left side)
   - Mobile logo section 
   - Uses different effects for branding

3. **Paywall Modal** (`/src/components/ui/PaywallModal.tsx`)
   - Footer branding in upgrade modals
   - Size: 100x32px with opacity

### 🎯 Theme Handling

The Logo component:
- Always shows `light.png` for both light and dark modes
- Navbar background adapts for optimal contrast in dark mode
- Uses white/light backgrounds to ensure logo visibility

## Additional Integration Opportunities

You can add the Logo component to:

1. **Loading States**
```tsx
<div className="flex items-center justify-center py-12">
  <Logo width={60} height={60} className="animate-pulse" />
  <span className="ml-3">Loading...</span>
</div>
```

2. **Error Pages**
```tsx
<div className="text-center">
  <Logo width={80} height={80} className="mx-auto mb-4" />
  <h1>Page Not Found</h1>
</div>
```

3. **Email Templates** (if using)
```tsx
<Logo width={120} height={40} />
```

4. **Footer** (if you add one)
```tsx
<footer className="border-t">
  <Logo width={100} height={32} className="opacity-60" />
</footer>
```

## Customization Examples

### Clickable Logo (Navigation)
```tsx
<Logo 
  onClick={() => navigate('/dashboard')}
  className="cursor-pointer hover:opacity-80 transition-opacity"
/>
```

### Large Branding Logo
```tsx
<Logo 
  width={200} 
  height={80} 
  className="mx-auto mb-8"
/>
```

### Small Icon Logo
```tsx
<Logo 
  width={24} 
  height={24} 
  className="inline-block"
/>
```

## File Structure
```
public/
└── images/
    └── logos/
        └── light.png  ← Logo file (used for all themes)

src/
└── components/
    └── ui/
        ├── Logo.tsx   ← Logo component
        └── index.ts   ← Exports Logo
```

## Benefits

✅ **Smart Background Adaptation** - Navbar background adapts for optimal logo visibility  
✅ **Consistent Branding** - Same component used everywhere  
✅ **Easy Maintenance** - Update logos in one place  
✅ **Performance Optimized** - Efficient loading and caching  
✅ **Accessibility** - Proper alt text and semantic markup  
✅ **TypeScript Support** - Full type safety and intellisense

## Notes

- Logo files should be optimized for web (compressed PNG or SVG)
- Recommended sizes: 200x80px or higher for best quality
- The component handles responsive sizing automatically
- Uses `object-fit: contain` to maintain aspect ratio 