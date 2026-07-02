import { redirect } from "next/navigation"

type Props = {
  params: Promise<{ id: string }>
}

export default async function TreatmentRedirect({ params }: Props) {
  const { id } = await params
  redirect(`/plan/${id}`)
}
