export default function Input({ label, type = 'text', value, onChange, placeholder, required, name, ...rest }) {
  return (
    <label className="block">
      {label && (
        <span className="block text-sm mb-2 text-[var(--text-secondary)] font-medium">
          {label}
        </span>
      )}
      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        className="w-full rounded-2xl px-4 py-3.5 glass text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] outline-none focus:border-[var(--text-primary)]/30 transition-colors"
        {...rest}
      />
    </label>
  )
}
