// /snapshot/[id] はフルスクリーン表示のため、ヘッダーを非表示にする専用レイアウト
export default function SnapshotViewLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
