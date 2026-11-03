import type { Alarm } from "@/lib/traffic-report";
import styles from "../admin.module.css";

/** One tile per check. Red = needs attention now; muted = could not be measured. */
export function AlarmsRow({ alarms }: { alarms: Alarm[] }) {
  const bad = alarms.filter((a) => a.level === "bad").length;
  return (
    <section className={styles.alarms} aria-label={bad ? `${bad} alarms` : "All clear"}>
      {alarms.map((a) => (
        <div key={a.id} className={`${styles.alarm} ${a.level === "bad" ? styles.alarmBad : a.level === "ok" ? styles.alarmOk : styles.alarmUnknown}`}>
          <div className={styles.alarmTitle}><span aria-hidden>{a.level === "bad" ? "⚠" : a.level === "ok" ? "✓" : "?"}</span> {a.title}</div>
          <div className={styles.alarmDetail}>{a.detail}</div>
        </div>
      ))}
    </section>
  );
}
