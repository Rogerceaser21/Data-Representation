---
date: 2026-05-28
from: igor.sesar@ais.ae
to: dave.richards@ais.ae
cc: leon.mckenna@ais.ae, steve.mcluckie@ais.ae
subject: R3 Data
purpose: kicking off the R3 evidence form build; requesting existing R3 data from Dave; explaining to Leon why R3 starts in Google Sheets rather than going straight into Supabase / MAIN database
---

# R3 Data

**To:** Dave Richards <dave.richards@ais.ae>
**CC:** Leon McKenna <leon.mckenna@ais.ae>, Steve McLuckie <steve.mcluckie@ais.ae>
**Subject:** R3 Data
**Sent:** 2026-05-28

---

Hi Dave,

Hope you're well. I'm starting work on a digital R3 evidence form (same approach as our new lesson observation form, web-based, with submissions landing in a structured database), and I need a hand from you to get going.

Two quick questions:

1. Do you already have any R3 data captured in an Excel or Google Sheets spreadsheet? If so, could you share it with me + Leon?
2. If not, could you send through the filled-out R3 forms you have on hand? I'm happy to extract the data myself and put it into a sheet. I've done this before, I'm confident I can do this without too much trouble.

Our time frame on this is tight, so the sooner we can get the existing data into a structured format, the sooner I can build the form on top of it. My plan is to work out of Google Sheets to start with rather than going straight to a permanent database.

Leon, the bit below is for you:

Just want to flag why I'm leaning Sheets-first rather than going straight into Supabase / "MAIN database" for R3, even though I know that's where everything is heading long term.

2 main reasons:

1. The users involved in R3 (the staff being observed) are already in my Supabase project as users (Mucking about with users in Supabase is very tricky and limited, but once MAIN database is live we can wire R3 records up to those user IDs (This is probably a project in itself). Starting in Sheets doesn't lock us out of that.
2. The Senior Leadership Team may decide they want to track additional things alongside R3 once they see the first version. Restructuring columns in a Sheet is trivial. Reshaping tables in Supabase mid-build is a lot of mucking around, particularly while we're still mapping out the MAIN database.

When we sit down to design the MAIN database properly, R3 can be one of the early offshoots that migrates across. Foreign Data Wrappers if we end up with two Supabase projects, as we discussed.

Happy to chat any of this through on Meet if useful.

Cheers,

Mr Igor Sesar
Primary School Digitech Teacher.
