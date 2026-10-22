export const STATUS = {
  gathering: { label: 'Interviewing client', tone: 'bg-sky-100 text-sky-800' },
  review: { label: 'Ready for your review', tone: 'bg-amber-100 text-amber-900' },
  awaiting_signoff: { label: 'Waiting for client approval', tone: 'bg-violet-100 text-violet-800' },
  signed: { label: 'Signed off', tone: 'bg-green-100 text-green-800' },
  changed: { label: 'Changed since sign-off', tone: 'bg-red-100 text-red-800' },
};

export const when = (d) =>
  new Date(d).toLocaleString('en-MY', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kuala_Lumpur' });

export const answerText = (a = {}) => [...(a.selected || []), a.other].filter(Boolean).join('; ');
