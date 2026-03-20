# Oibre Mobile Responsiveness TODO

## Priority: Customer Frontend First

- [ ] 1. Update `customer/frontend/tailwind.config.js` - Add custom screens (sm:548px, md:768px, lg:1024px), extend theme with CSS vars (colors, spacing, shadows).
- [ ] 2. Edit `customer/frontend/src/App.jsx` - Wrap routes in responsive container (div className="min-h-screen bg-gray-50"), Navbar already good.
- [ ] 3. Enhance `customer/frontend/src/components/Navbar.jsx` - Add Tailwind responsive classes to elements (e.g., hidden md:block for desktop nav).
- [ ] 4. Update key pages with Tailwind responsive:
  - [ ] `customer/frontend/src/pages/Home.jsx` - Grids: grid-cols-1 md:grid-cols-2 lg:grid-cols-3/4
  - [ ] `customer/frontend/src/pages/CustomerProfile.jsx` - Forms/layouts responsive flex/grid
  - [ ] `customer/frontend/src/pages/SearchResults.jsx` - Results grid responsive
  - [ ] `customer/frontend/src/pages/MyOrders.jsx` - Orders table → mobile cards
- [ ] 5. CSS refinements: Ensure designSystem.css/navbar-improved.css use Tailwind @layer base/utilities; no fixed widths.
- [ ] 6. Test: cd customer/frontend && npm install && npm run dev; Test iPhone/Portrait Tablet/Landscape/Desktop in DevTools. Fix touch targets, overflow-x:hidden.
- [ ] 7. Extend to service-provider-web/frontend (ProviderDashboard.js, ProviderStyles.css responsive grids).
- [ ] 8. Update service-provider/frontend, admin/frontend similarly.
- [ ] 9. Final: attempt_completion with "All frontends mobile-responsive", command to open customer/frontend/index.html.

**Current Progress: Steps 1-4 ✅ (Customer pages responsive Tailwind grids/flex added)**  

- [ ] 5. CSS refinements & test in dev server.
- [ ] 6. Extend to other frontends.

