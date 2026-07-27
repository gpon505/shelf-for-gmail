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
