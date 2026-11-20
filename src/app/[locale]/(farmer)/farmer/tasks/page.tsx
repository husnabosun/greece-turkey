import { setRequestLocale } from "next-intl/server";
import { TasksScreen } from "@/features/tasks/tasks-screen";

type Props = { params: Promise<{ locale: string }> };

export default async function TasksPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <TasksScreen />;
}
