export function formatDate(date: string | Date, format = "YYYY-MM-DD") {
  const d = new Date(date)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  if (format === "YYYY-MM-DD") return `${year}-${month}-${day}`
  return `${year}-${month}-${day} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
}

export function formatDateTime(date: string | Date) {
  return formatDate(date, "YYYY-MM-DD HH:mm")
}
