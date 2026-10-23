import type { Metadata } from "next";
import styles from "./operator.module.css";

export const metadata: Metadata = {
  title: "Operator console",
  robots: { index: false, follow: false }
};

export default function OperatorLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <div className={styles.shell}>{children}</div>;
}
