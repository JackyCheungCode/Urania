# Urania UI system: Carbon Design System

Carbon is the sole product UI system for Urania.

## Mandatory implementation rules

- Use official `@carbon/react` components for all interactive controls and data-display primitives: buttons, text inputs, password inputs, selects, checkboxes, radio buttons, toggles, sliders, date pickers, tabs, menus, overflow menus, modals, notifications, inline notifications, tooltips, data tables, pagination, skeletons, loading indicators, and form validation.
- Use `@carbon/icons-react` for interface icons. Do not introduce another general-purpose icon library.
- Use Carbon themes and design tokens for color, typography, spacing, layers, borders, focus, motion, and responsive breakpoints.
- Compose page layouts from Carbon Grid, Column, Stack, Tile, SideNav, Header, Content, and other official components where appropriate.
- Domain-specific charts and visualizations may use a specialist visualization library, but their surrounding controls, typography, spacing, colors, and interaction states must use Carbon tokens.
- Do not implement custom HTML/CSS controls that duplicate Carbon component behavior. Do not skin native controls to imitate Carbon.
- Do not override Carbon component internals or token values in application CSS. Application CSS is limited to domain layout/composition and non-interactive brand assets.
- New UI code must not add `lucide-react`, bespoke button/input/select/modal/table components, or arbitrary hex colors for interface states.
- Existing screens are not considered migrated until every interactive control on the screen uses Carbon components.

## Migration acceptance checklist

- [ ] Authentication and session states
- [ ] Global shell, header, side navigation, breadcrumbs, search and notifications
- [ ] Overview dashboard and all data tables
- [ ] Product research, scoring and profit calculator
- [ ] CRM accounts, contacts, leads, opportunities, activities, quotes and orders
- [ ] Intelligence and automation pages
- [ ] Integration center and credential dialogs
- [ ] Workspace settings, permissions and audit views
- [ ] Responsive/mobile navigation and all empty/loading/error states
- [ ] Remove obsolete bespoke control CSS and legacy icon imports
- [ ] Accessibility: keyboard navigation, visible focus, labels, descriptions and dialog semantics
- [ ] Typecheck, tests, production build and visual QA at desktop/tablet/mobile widths

A Carbon theme wrapper or Carbon stylesheet alone does not constitute completion. Every screen must pass the checklist before the migration can be declared complete.
