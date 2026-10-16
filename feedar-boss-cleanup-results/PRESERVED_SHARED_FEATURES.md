# Shared features preserved

- Owner/Admin/User navigation and underlying pages for operations, remote sessions, display, members, invitations, maps, activity and settings remain available according to existing role guards.
- Public organization pages, invitation redemption, session links, robot kiosk routes and demo authentication were not deleted.
- Scoped Boss can still enter an organization, use its management navigation, change organization settings, and return with Back to Boss. The actual Boss identity remains the actor in audit records.
- Registry, pairing, credit ledger, organization lifecycle, persistence, authorization, audit and IndexedDB migration modules were not removed or reset.
- Existing organizations, robots, logos, quotas, memberships, invitations and local data were not deleted by this cleanup. Hiding form controls leaves current model values available for save.
- Robot-control service and its previously reported defects were not altered. Passing simulator regression tests does not establish that those defects are fixed or validate physical hardware.
