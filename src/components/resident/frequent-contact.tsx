const contactColors = ["bg-[#d9e9ff] text-[#1550df]", "bg-[#c8f8df] text-[#00845f]", "bg-[#ece5ff] text-[#6d16e8]"];

export function ContactAvatar({ contact, index = 0 }: { contact: { name: string }; index?: number }) {
  const initial = contact.name.trim().charAt(0).toLocaleUpperCase("es-VE") || "?";
  return <span aria-hidden="true" className={`flex h-14 w-14 items-center justify-center rounded-full text-xl font-bold ${contactColors[index % contactColors.length]}`}>{initial}</span>;
}
