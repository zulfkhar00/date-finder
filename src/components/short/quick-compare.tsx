import { Check, X } from "lucide-react";

const columns = [
  { name: "You alone", note: "" },
  { name: "Message tools", note: "Rizz, YourMove AI, Keys AI" },
  { name: "Matchmaker", note: "" },
  { name: "NoSwipe", note: "" }
];
// true = yes. Facts only: message tools suggest what to say, you send. The account-risk row is honest:
// NoSwipe works on your own apps, and the apps restrict automated tools.
const rows: { label: string; cells: [boolean, boolean, boolean, boolean] }[] = [
  { label: "Suggests what to say", cells: [false, true, false, true] },
  { label: "Swipes for you", cells: [false, false, false, true] },
  { label: "Chats as you", cells: [false, false, false, true] },
  { label: "Sets up the date", cells: [false, false, true, true] },
  { label: "No account risk", cells: [true, true, true, false] }
];

export function QuickCompare() {
  return (
    <section className="shell short-compare" aria-labelledby="quick-compare-title">
      <h2 id="quick-compare-title" className="short-h2">At a glance</h2>
      <table className="qc">
        <thead>
          <tr>
            <th scope="col"><span className="sr-only">Feature</span></th>
            {columns.map((c, i) => (
              <th scope="col" key={c.name} data-us={i === columns.length - 1}>
                {c.name}
                {c.note ? <small>{c.note}</small> : null}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label}>
              <th scope="row">{row.label}</th>
              {row.cells.map((yes, i) => (
                <td key={i} data-us={i === columns.length - 1}>
                  {yes ? <Check size={18} strokeWidth={3.2} aria-label="Yes" /> : <X size={18} strokeWidth={3.2} aria-label="No" className="qc-no" />}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="qc-note">Each tool suits a different person. Details below.</p>
    </section>
  );
}
