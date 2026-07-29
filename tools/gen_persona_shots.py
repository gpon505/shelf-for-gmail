#!/usr/bin/env python3
# Generates persona "after" shot pages (GTD, Eisenhower, Sales) from one
# template, sharing the staged-Gmail chrome of tools/shot-after.html.
# Then screenshot each with headless Chrome (see repo git log / README).
import json
import os

TEMPLATE = """<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>%(title)s</title>
<link rel="stylesheet" href="/shelf.css">
<style>
  * { box-sizing: border-box; }
  body { margin: 0; font: 14px Roboto, RobotoDraft, Helvetica, Arial, sans-serif;
         color: #202124; background: #f6f8fc; }
  .top { display: flex; align-items: center; gap: 16px; padding: 8px 16px; height: 56px; }
  .logo { font: 500 20px 'Google Sans', Roboto, sans-serif; color: #5f6368; }
  .logo b { color: #ea4335; font-weight: 500; }
  .search { flex: 0 1 640px; background: #eaf1fb; border-radius: 24px; padding: 10px 20px; color: #3c4043; }
  .shell { display: flex; }
  .side { width: 216px; padding: 8px 0 0 8px; flex: none; }
  .compose { display: inline-flex; align-items: center; gap: 10px; background: #c2e7ff;
             border-radius: 16px; padding: 14px 20px;
             font: 500 14px 'Google Sans', Roboto, sans-serif; margin: 4px 0 12px 4px; }
  .nav { padding: 4px 18px 4px 26px; border-radius: 0 16px 16px 0; line-height: 30px;
         color: #202124; display: flex; justify-content: space-between; }
  .nav.on { background: #d3e3fd; font-weight: 700; }
  .nav span.n { color: #5f6368; font-size: 12px; font-weight: 400; }
  .main { flex: 1; background: #fff; border-radius: 16px; margin: 0 16px 16px 0;
          min-height: 700px; padding-bottom: 24px; }
  .toolbar { display: flex; align-items: center; gap: 4px; padding: 8px 12px; color: #444746; }
  .tbtn { display: inline-flex; align-items: center; justify-content: center; width: 40px;
          height: 40px; border-radius: 50%%; cursor: pointer; font-size: 18px; }
  .count { margin-left: auto; color: #5f6368; font-size: 12px; padding-right: 12px; }
  table.F { width: 100%%; border-collapse: collapse; }
  tr.zA { cursor: pointer; }
  tr.zA td { border-bottom: 1px solid #f1f3f4; padding: 0 8px; height: 40px; white-space: nowrap; }
  td.cb, td.st { width: 28px; color: #5f6368; text-align: center; font-size: 16px; }
  td.who { width: 190px; font-weight: 700; overflow: hidden; text-overflow: ellipsis; }
  td.subj { max-width: 0; width: 99%%; overflow: hidden; text-overflow: ellipsis; }
  td.subj .bog { font-weight: 700; }
  td.subj .snip { color: #5f6368; }
  td.when { width: 88px; text-align: right; color: #202124; font-size: 12px; font-weight: 700; }
  tr.zA.read td.who, tr.zA.read td.subj .bog, tr.zA.read td.when { font-weight: 400; }
  tr.zA.read td { background: #f6f8fc55; }
  td.when ul { display: none; }
</style>
</head>
<body>
<script>
window.chrome = {
  runtime: { lastError: null, id: 'shotextensionid00000000000000000' },
  storage: {
    local: {
      _d: %(store)s,
      get(k, cb) { cb(Object.assign({}, this._d)); },
      set(o, cb) { Object.assign(this._d, o); if (cb) cb(); },
      remove(k, cb) { delete this._d[k]; if (cb) cb(); }
    },
    sync: { get(k, cb) { cb({}); }, set(o, cb) { if (cb) cb(); }, remove(k, cb) { if (cb) cb(); } },
    onChanged: { addListener() {} }
  }
};
location.hash = %(hash)s;
</script>
<div class="top">
  <span class="logo"><b>M</b> Gmail</span>
  <div class="search">%(search)s</div>
</div>
<div class="shell">
  <div class="side">
    <div class="compose">✏️ Compose</div>
%(nav)s
  </div>
  <div class="main">
    <div class="toolbar">
      <span class="tbtn">▢</span>
      <span class="tbtn">⟳</span>
      <span class="tbtn">⋮</span>
      <span class="count">1–%(n)s of %(n)s</span>
    </div>
    <table class="F"><tbody>
%(rows)s
    </tbody></table>
  </div>
</div>
<script src="/content.js?v=1"></script>
</body>
</html>
"""


def nav_html(items, active):
    out = []
    for name, badge in items:
        cls = ' on' if name == active else ''
        b = '<span class="n">%s</span>' % badge if badge else ''
        out.append('    <div class="nav%s">%s %s</div>' % (cls, name, b))
    return '\n'.join(out)


def row_html(tid, who, subj, snip, when, read):
    cls = 'zA read' if read else 'zA'
    return ('      <tr class="%s"><td class="cb">▢</td><td class="st">☆</td>'
            '<td class="who"><span data-legacy-thread-id="%s"></span>%s</td>'
            '<td class="subj"><span class="bog">%s</span> <span class="snip">— %s</span></td>'
            '<td class="when"><span class="date">%s</span><ul role="toolbar"></ul></td></tr>'
            % (cls, tid, who, subj, snip, when))


PERSONAS = {
    'parents': {
        'title': 'parents', 'label': 'Family', 'hash': '#label/Family',
        'search': 'label:Family',
        'nav': [('Inbox', '2,341'), ('Starred', ''), ('Snoozed', ''), ('Sent', ''),
                ('Family', '11'), ('School', ''), ('Activities', '')],
        'active': 'Family',
        'sections': [
            {'id': 'nr', 'name': 'Needs a reply', 'collapsed': False, 'c': 'red'},
            {'id': 'tw', 'name': 'This week', 'collapsed': False, 'c': 'blue'},
            {'id': 'su', 'name': 'Sign-ups & forms', 'collapsed': False, 'c': 'yellow'},
        ],
        'assign': {'p1': 'nr', 'p6': 'nr', 'p11': 'nr', 'p2': 'tw', 'p5': 'tw',
                   'p7': 'tw', 'p3': 'su', 'p4': 'su'},
        'notes': {
            'p1': {'text': 'reply before conferences Thu', 't': 1, 'c': 'red'},
            'p2': {'text': 'carpool with the Jensens', 't': 1, 'c': 'yellow'},
            'p3': {'text': 'medical form still missing', 't': 1, 'c': 'yellow'},
            'p5': {'text': 'book with the new insurance', 't': 1},
            'p11': {'text': 'send her the album link', 't': 1},
        },
        'rows': [
            ('p1', 'Ms. Alvarez (Room 12)', 'Reading log check-in', 'Sofia is doing great — a quick question about the…', '2:58 PM', False),
            ('p6', "Emma's Ballet", 'Recital costume sizes needed', 'Please reply with your dancer’s size by Monday…', '12:14 PM', False),
            ('p11', 'Grandma', 'Photos from the lake!!', 'Finally figured out how to attach these — look at…', '10:40 AM', False),
            ('p2', 'Coach Danny', 'Saturday game moved to 9am', 'Field conflict — we swapped slots with the U10s…', 'Jul 25', True),
            ('p5', 'Pediatric Dental', 'Time for a check-up', 'Our records show it has been six months since…', 'Jul 25', True),
            ('p7', 'School District', 'Bus route changes for fall', 'Route 12 will now stop at Alder & 5th beginning…', 'Jul 24', True),
            ('p3', 'Lakeside Summer Camp', 'Session 2 forms due Friday', 'We still need the medical release for your camper…', 'Jul 24', False),
            ('p4', 'PTA', 'Bake sale volunteers needed', 'Two more table slots to fill for Friday afternoon…', 'Jul 23', True),
            ('p8', 'Scholastic', 'Book order confirmation', 'Your class order has been received and will ship…', 'Jul 23', True),
            ('p9', 'Amazon', 'Your order has shipped', 'Cleats, size 3 — arriving Thursday by 8pm…', 'Jul 22', True),
            ('p10', 'Netflix', 'New sign-in on TV', 'We noticed a new sign-in on a device you don’t…', 'Jul 21', True),
        ],
    },
    'gtd': {
        'title': 'gtd', 'label': 'Action', 'hash': '#label/Action',
        'search': 'label:Action',
        'nav': [('Inbox', '1,204'), ('Starred', ''), ('Snoozed', ''), ('Sent', ''),
                ('Action', '11'), ('Reference', ''), ('Read Later', '4')],
        'active': 'Action',
        'sections': [
            {'id': 'na', 'name': 'Next actions', 'collapsed': False, 'c': 'blue'},
            {'id': 'wf', 'name': 'Waiting for', 'collapsed': False, 'c': 'red'},
            {'id': 'sm', 'name': 'Someday / maybe', 'collapsed': False},
        ],
        'assign': {'g1': 'na', 'g3': 'na', 'g7': 'na', 'g2': 'wf', 'g4': 'wf',
                   'g11': 'wf', 'g5': 'sm', 'g6': 'sm'},
        'notes': {
            'g1': {'text': '@computer — merge doc edits', 't': 1},
            'g2': {'text': 'asked for status Tue', 't': 1, 'c': 'red'},
            'g3': {'text': 'book by Friday', 't': 1, 'c': 'yellow'},
            'g11': {'text': 'he owes the intro email', 't': 1, 'c': 'yellow'},
        },
        'rows': [
            ('g1', 'Dana Whitfield', 'Re: Q3 planning doc', 'left comments on sections 2 and 4, mostly small…', '2:41 PM', False),
            ('g2', 'IT Helpdesk', 'Ticket #5521 — monitor flicker', 'Your ticket has been assigned to a technician…', '11:20 AM', True),
            ('g3', 'Mia, me 3', 'Flight options for October', 'The Tuesday departure is $160 cheaper if we…', '9:05 AM', False),
            ('g4', 'Turbo Rentals', 'Your quote is ready', 'Thanks for your interest — the weekly rate for…', 'Jul 25', True),
            ('g7', 'Alex Chen', 'Team offsite — vote on dates', 'Poll closes Friday, three options on the table…', 'Jul 25', False),
            ('g11', 'Sam Lee', 'Re: mentorship intro', 'Happy to connect you two — let me dig up her…', 'Jul 24', True),
            ('g5', 'Ravi Patel', 'Intro — product analytics tool', 'Saw your post about dashboards, thought of…', 'Jul 23', True),
            ('g6', 'Weekend Woodworking', 'Issue #214: joinery basics', 'Three joints every beginner should know, plus…', 'Jul 22', True),
            ('g8', 'Payroll', 'Your July statement', 'Your statement is now available in the portal…', 'Jul 21', True),
            ('g9', 'Nextdoor Digest', '3 new posts near you', 'Missing cat on Alder St, free bricks, block party…', 'Jul 21', True),
            ('g10', "Dr. Osei's office", 'Appointment reminder', 'This is a reminder of your appointment on…', 'Jul 20', True),
        ],
    },
    'matrix': {
        'title': 'matrix', 'label': ':inbox', 'hash': '#inbox',
        'search': 'Search mail',
        'nav': [('Inbox', '11'), ('Starred', ''), ('Snoozed', ''), ('Sent', ''),
                ('Action', ''), ('Pending', ''), ('Read Later', '')],
        'active': 'Inbox',
        'sections': [
            {'id': 'ui', 'name': 'Urgent & important', 'collapsed': False, 'c': 'red'},
            {'id': 'sc', 'name': 'Schedule', 'collapsed': False, 'c': 'blue'},
            {'id': 'dg', 'name': 'Delegate', 'collapsed': False, 'c': 'yellow'},
            {'id': 'sd', 'name': 'Someday', 'collapsed': False, 'c': 'gray'},
        ],
        'assign': {'m1': 'ui', 'm5': 'ui', 'm4': 'sc', 'm9': 'sc', 'm2': 'dg',
                   'm6': 'dg', 'm3': 'sd', 'm7': 'sd', 'm8': 'sd'},
        'notes': {
            'm1': {'text': 'numbers to Foster by Thu 9am', 't': 1, 'c': 'red'},
            'm2': {'text': 'hand to Marcus', 't': 1},
            'm4': {'text': 'pick dates with Ali', 't': 1, 'c': 'yellow'},
        },
        'rows': [
            ('m1', 'Principal Foster', 'Budget revision due Thursday', 'Board wants the revised numbers before the…', '3:12 PM', False),
            ('m5', 'Tessa, me 2', 'Re: field trip permission forms', 'Still missing nine forms — list attached, can…', '1:47 PM', False),
            ('m4', 'District PD', 'Sign up: fall training cohorts', 'Registration for fall cohorts closes August 8…', '10:02 AM', False),
            ('m9', 'Registrar', 'Transcript request #1189', 'A transcript has been requested for a former…', 'Jul 25', True),
            ('m2', 'Facilities', 'AC contractor quote approval', 'Two quotes attached for the unit replacement…', 'Jul 25', True),
            ('m6', 'SmartBoards Inc.', 'Renewal pricing for your school', 'Your classroom display licenses renew Sept 1…', 'Jul 24', True),
            ('m3', 'Jamie Wong', 'Coffee to discuss book club?', 'No rush at all — thinking sometime after the…', 'Jul 24', True),
            ('m7', 'EdWeek', 'This week in education', 'Teacher shortages, new reading study, and…', 'Jul 23', True),
            ('m8', 'Peak Fitness', 'Membership renewal offer', 'Renew before August and lock in your current…', 'Jul 22', True),
            ('m10', 'Mom', 'Sunday dinner?', 'Thinking 5:30 — your brother is bringing the…', 'Jul 22', False),
            ('m11', 'First National', 'Statement available', 'Your July statement is ready to view in online…', 'Jul 21', True),
        ],
    },
    'priorities': {
        'title': 'priorities', 'label': 'Action', 'hash': '#label/Action',
        'search': 'label:Action',
        'nav': [('Inbox', '1,893'), ('Starred', ''), ('Snoozed', ''), ('Sent', ''),
                ('Action', '11'), ('Pending', ''), ('Read Later', '')],
        'active': 'Action',
        'sections': [
            {'id': 'ui', 'name': 'Urgent & important', 'collapsed': False, 'c': 'red'},
            {'id': 'tw', 'name': 'This week', 'collapsed': False, 'c': 'yellow'},
            {'id': 'sn', 'name': 'Sunday morning', 'collapsed': False, 'c': 'blue'},
        ],
        'assign': {'u1': 'ui', 'u2': 'ui', 'u3': 'tw', 'u4': 'tw', 'u5': 'tw',
                   'u6': 'sn', 'u7': 'sn', 'u8': 'sn'},
        'notes': {
            'u1': {'text': 'sign before 5 today', 't': 1, 'c': 'red'},
            'u2': {'text': 'refund approved — confirm with Nina', 't': 1, 'c': 'red'},
            'u3': {'text': 'resolve comments before Thu', 't': 1, 'c': 'yellow'},
            'u4': {'text': 'decide by Aug 1', 't': 1},
            'u6': {'text': 'she deserves more than two lines', 't': 1},
        },
        'rows': [
            ('u1', 'Marcus Webb', 'Offer letter — final sign-off', 'Legal cleared it this morning — we risk losing her if…', '2:47 PM', False),
            ('u2', 'Nina Kowalski', 'Client escalation: duplicate invoices', 'They found two more charges — call scheduled for…', '11:32 AM', False),
            ('u3', 'Dev Patel', 'Q3 roadmap review comments', 'Left notes in the doc — mostly the timeline for the…', '9:20 AM', False),
            ('u5', 'Hannah Ruiz', 'Interview loop for the analyst role', 'Can you take the Thursday 2pm slot? Panel is…', 'Jul 28', False),
            ('u4', 'Whitfield Insurance', 'Policy renewal — two options', 'Both quotes attached — the difference is mostly the…', 'Jul 28', True),
            ('u6', 'Aunt Carol', 'Reunion planning!!', 'The lake house is booked for Labor Day weekend…', 'Jul 27', True),
            ('u7', 'Ben (cycling club)', 'Century ride logistics', 'Route options and the rest-stop plan for the 16th…', 'Jul 26', True),
            ('u8', 'City Rec Center', 'Fall league registration open', 'Team registration closes August 15 — returning…', 'Jul 25', True),
            ('u9', 'Concur', 'Expense report approved', 'Your July report was approved and will be paid out…', 'Jul 24', True),
            ('u10', 'LinkedIn', 'You have 4 new notifications', 'People are viewing your profile — see who…', 'Jul 23', True),
            ('u11', 'Morning Brew', 'Tuesday: chips, rates, and rain', 'Good morning. Here is what is moving markets…', 'Jul 22', True),
        ],
    },
    'reading': {
        'title': 'reading', 'label': 'Read Later', 'hash': '#label/Read Later',
        'search': 'label:Read Later',
        'nav': [('Inbox', '968'), ('Starred', ''), ('Snoozed', ''), ('Sent', ''),
                ('Action', ''), ('Pending', ''), ('Read Later', '11')],
        'active': 'Read Later',
        'sections': [
            {'id': 'rs', 'name': 'Research', 'collapsed': False, 'c': 'blue'},
            {'id': 'lr', 'name': 'Long reads', 'collapsed': False, 'c': 'green'},
            {'id': 'ff', 'name': 'Just for fun', 'collapsed': False, 'c': 'yellow'},
        ],
        'assign': {'r1': 'rs', 'r2': 'rs', 'r3': 'rs', 'r4': 'lr', 'r5': 'lr',
                   'r6': 'lr', 'r7': 'ff', 'r8': 'ff', 'r9': 'ff'},
        'notes': {
            'r1': {'text': 'cite in the August PD deck', 't': 1, 'c': 'blue'},
            'r3': {'text': 'middle section is the good part, she says', 't': 1},
            'r7': {'text': 'Sunday dinner?', 't': 1, 'c': 'yellow'},
        },
        'rows': [
            ('r1', 'Learning & the Brain', 'New study: retrieval practice at scale', 'Researchers followed 4,200 students across two…', '8:12 AM', False),
            ('r2', 'EdResearch Weekly', 'Meta-analysis: tutoring dosage', 'How many minutes per week actually move the…', 'Jul 28', True),
            ('r3', 'Sofia Marks', 'That phonics article I mentioned', 'Here is the piece from the conference — curious…', 'Jul 27', False),
            ('r4', 'The Atlantic', 'The elevator that made cities vertical', 'Before the safety brake, no building rose past six…', 'Jul 27', True),
            ('r5', 'Longreads', 'The last lighthouse keeper', 'For forty-one years, one man kept the light on a…', 'Jul 25', True),
            ('r6', 'The New Yorker', 'The deep sea’s quietest mystery', 'Four miles down, something is making a sound…', 'Jul 24', True),
            ('r7', 'Serious Eats', 'The science of crispy smashed potatoes', 'Starch, steam, and why your oven is lying about…', 'Jul 24', True),
            ('r8', 'Uncle Pete', 'you will love this (trombone flashmob)', 'JUST WATCH IT. the kid at 0:40 absolutely loses…', 'Jul 23', True),
            ('r9', 'Atlas Obscura', 'The mystery vending machines of Kyoto', 'Nobody restocks them. Everybody buys from them…', 'Jul 22', True),
            ('r10', 'Pocket Digest', 'Your weekly recommendations', 'Based on your saves: five stories worth your…', 'Jul 21', True),
            ('r11', 'Goodreads', 'August newsletter', 'New releases in your favorite genres, plus the…', 'Jul 20', True),
        ],
    },
    'person': {
        'title': 'person', 'label': 'Priya', 'hash': '#label/Priya',
        'search': 'label:Priya',
        'nav': [('Inbox', '1,412'), ('Starred', ''), ('Snoozed', ''), ('Sent', ''),
                ('Priya', '9'), ('Team', ''), ('Vendors', '')],
        'active': 'Priya',
        'sections': [
            {'id': 'oo', 'name': 'For Thursday’s 1:1', 'collapsed': False, 'c': 'blue'},
            {'id': 'pj', 'name': 'Projects together', 'collapsed': False, 'c': 'green'},
            {'id': 'wr', 'name': 'Website redesign', 'collapsed': False, 'p': 'pj'},
            {'id': 'qh', 'name': 'Q3 hiring', 'collapsed': False, 'p': 'pj'},
            {'id': 'wp', 'name': 'Waiting on Priya', 'collapsed': False, 'c': 'red'},
        ],
        'assign': {'pn1': 'oo', 'pn2': 'oo', 'pn3': 'wr', 'pn4': 'wr',
                   'pn5': 'qh', 'pn6': 'qh', 'pn7': 'wp'},
        'notes': {
            'pn1': {'text': 'she’s hesitant — bring examples', 't': 1, 'c': 'blue'},
            'pn2': {'text': 'agree on the ask before Thursday', 't': 1, 'c': 'yellow'},
            'pn3': {'text': 'my turn — edits due Wed', 't': 1},
            'pn7': {'text': 'she owes the sheet — nudge Friday', 't': 1, 'c': 'red'},
        },
        'rows': [
            ('pn1', 'Priya Nair', 'Team retro format', 'Want to try the sailboat format next sprint? I can…', '3:05 PM', False),
            ('pn2', 'Priya Nair', 'Budget for the offsite', 'Finance came back with a number — lower than we…', '10:41 AM', False),
            ('pn3', 'Priya, me 5', 'Homepage copy v3', 'Latest draft attached — I tightened the hero and…', 'Jul 28', False),
            ('pn4', 'Priya, Dana 3', 'Nav menu user testing', 'Five sessions booked for next week — the script is…', 'Jul 27', True),
            ('pn5', 'Priya Nair', 'Analyst JD draft', 'Rewrote the requirements section — flagging the…', 'Jul 27', True),
            ('pn6', 'Greenhouse', 'New referral: Sam Osei', 'Priya Nair referred Sam Osei for the analyst…', 'Jul 25', True),
            ('pn7', 'Priya Nair', 'Vendor shortlist', 'I owe you the comparison sheet — grabbing time…', 'Jul 24', True),
            ('pn8', 'Priya Nair', 'Fwd: conference discount code', 'Expires Friday — 30% off if we register as a…', 'Jul 23', True),
            ('pn9', 'Priya Nair', 'Fun: our app in the wild', 'Someone posted a screenshot of the dashboard…', 'Jul 22', True),
        ],
    },
    'hiring': {
        'title': 'hiring', 'label': 'Hiring', 'hash': '#label/Hiring',
        'search': 'label:Hiring',
        'nav': [('Inbox', '742'), ('Starred', ''), ('Snoozed', ''), ('Sent', ''),
                ('Hiring', '11'), ('Team', ''), ('Recruiters', '')],
        'active': 'Hiring',
        'sections': [
            {'id': 'of', 'name': 'Offers out', 'collapsed': False, 'c': 'red'},
            {'id': 'iw', 'name': 'Interviews this week', 'collapsed': False, 'c': 'blue'},
            {'id': 'ts', 'name': 'To schedule', 'collapsed': False, 'c': 'yellow'},
            {'id': 'na', 'name': 'New applicants', 'collapsed': False, 'c': 'green'},
        ],
        'assign': {'h1': 'of', 'h2': 'of', 'h3': 'iw', 'h4': 'iw', 'h5': 'ts',
                   'h6': 'ts', 'h7': 'na', 'h8': 'na', 'h9': 'na'},
        'notes': {
            'h1': {'text': 'comp answer by EOD — don’t lose her', 't': 1, 'c': 'red'},
            'h2': {'text': 'countersign today', 't': 1, 'c': 'red'},
            'h3': {'text': 'prep: system design rubric', 't': 1, 'c': 'blue'},
            'h5': {'text': 'needs a panel — ask Dev & Nina', 't': 1, 'c': 'yellow'},
            'h7': {'text': 'strong portfolio — fast-track?', 't': 1},
        },
        'rows': [
            ('h1', 'Maya Torres', 'Re: Offer — excited, one question', 'Thank you again! Before I sign — is there any…', '3:22 PM', False),
            ('h2', 'Rob Feldman', 'Danielle accepted — paperwork', 'She said yes on the call — sending the packet for…', '1:15 PM', False),
            ('h3', 'Alex Kim', 'Confirmed: Thursday 10am panel', 'Looking forward to it — anything I should prepare…', '9:47 AM', False),
            ('h4', 'Jordan Baptiste', 'Portfolio ahead of Friday', 'As promised, three case studies — the middle one…', 'Jul 28', False),
            ('h5', 'Sarah Lindqvist', 'Availability next week', 'Happy to make most mornings work — Tuesday is…', 'Jul 27', False),
            ('h6', 'Lever', 'Phone screen feedback due', 'Feedback for two candidates is waiting on your…', 'Jul 27', True),
            ('h7', 'Lever', 'New applicant: Chidi Okafor', 'Senior Analyst — 6 yrs experience, portfolio…', 'Jul 25', True),
            ('h8', 'Lever', 'New applicant: Grace Park', 'Senior Analyst — referred by an employee, resume…', 'Jul 25', True),
            ('h9', 'Marcus Webb', 'My former teammate is looking', 'She led reporting at my last company — intro if…', 'Jul 24', True),
            ('h10', 'LinkedIn Talent', 'Your job post performance', 'Your Senior Analyst post got 340 views this week…', 'Jul 23', True),
            ('h11', 'People Ops Weekly', 'Structured interviews, revisited', 'Why unstructured interviews feel better and predict…', 'Jul 22', True),
        ],
    },
    'sales': {
        'title': 'sales', 'label': 'Clients', 'hash': '#label/Clients',
        'search': 'label:Clients',
        'nav': [('Inbox', '86'), ('Starred', ''), ('Snoozed', ''), ('Sent', ''),
                ('Clients', '11'), ('Leads', ''), ('Internal', '')],
        'active': 'Clients',
        'sections': [
            {'id': 'cw', 'name': 'Closing this week', 'collapsed': False, 'c': 'red'},
            {'id': 'ic', 'name': 'In conversation', 'collapsed': False, 'c': 'blue'},
            {'id': 'nl', 'name': 'New leads', 'collapsed': False, 'c': 'green'},
        ],
        'assign': {'s1': 'cw', 's6': 'cw', 's2': 'ic', 's7': 'ic', 's11': 'ic',
                   's3': 'nl', 's9': 'nl'},
        'notes': {
            's1': {'text': 'legal review back Wed', 't': 1, 'c': 'red'},
            's2': {'text': 'send the Fenwick case study', 't': 1, 'c': 'yellow'},
            's3': {'text': 'warm intro — respond today', 't': 1},
            's7': {'text': 'loop in engineering', 't': 1, 'c': 'yellow'},
        },
        'rows': [
            ('s1', 'Priya Sharma (Acme)', 'Re: MSA redlines', 'Our counsel accepted most of your edits — two…', '4:05 PM', False),
            ('s6', "Kevin O'Neal", 'Renewal call follow-up', 'Good talking today — send over the two-year…', '11:30 AM', False),
            ('s2', 'Tom Aldous', 'Pricing questions after demo', 'The team was impressed — a few questions on…', '9:58 AM', False),
            ('s7', 'Maggie Liu', 'Security questionnaire', 'Attached is our standard vendor review — 30…', 'Jul 25', True),
            ('s11', 'Frank Wu', 'Re: proposal v2', 'V2 looks much closer. Two line items to discuss…', 'Jul 25', False),
            ('s3', 'Jess Marino (Northstar)', 'Intro from Chris', 'Chris said you two should talk — we are looking…', 'Jul 24', False),
            ('s9', 'Aaron Diaz (Brightline)', 'Demo request', 'Found you through the marketplace — could we…', 'Jul 24', True),
            ('s4', 'Billing', 'Invoice #2201 paid', 'Payment received from Meridian Co — no action…', 'Jul 23', True),
            ('s8', 'SaaSConnect', 'Booth confirmation', 'Your booth assignment and setup times for the…', 'Jul 22', True),
            ('s5', 'Deel HR', 'Contractor onboarding', 'Your new contractor has completed onboarding…', 'Jul 22', True),
            ('s10', 'CRM digest', '4 tasks due today', 'You have 4 tasks due: 2 calls, 1 follow-up, 1…', 'Jul 21', True),
        ],
    },
}


def build(name, p):
    label = p['label']
    store = {
        'sections': {label: {'list': p['sections'], 'elseCollapsed': False}},
        'sectionsRev': 1,
        'assignments': {tid: {'s': sec, 't': i + 1}
                        for i, (tid, sec) in enumerate(p['assign'].items())},
        'hintDone': True,
    }
    for tid, note in p['notes'].items():
        store['note:' + tid] = note
    html = TEMPLATE % {
        'title': p['title'],
        'store': json.dumps(store),
        'hash': json.dumps(p['hash']),
        'search': p['search'],
        'nav': nav_html(p['nav'], p['active']),
        'n': len(p['rows']),
        'rows': '\n'.join(row_html(*r) for r in p['rows']),
    }
    out = os.path.join(os.path.dirname(__file__), 'shot-%s.html' % name)
    with open(out, 'w') as f:
        f.write(html)
    print('wrote', out)


if __name__ == '__main__':
    for name, p in PERSONAS.items():
        build(name, p)
