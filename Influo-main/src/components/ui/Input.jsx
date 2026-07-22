export default function Input({ label, type = 'text', value, onChange, placeholder, required, name, ...rest }) {
  return (
    <label className="block">
      {label && (
        <span className="block text-caption-medium mb-2 text-[var(--text-secondary)]">
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
        className="w-full h-12 rounded-2xl px-4 glass text-body text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] outline-none focus:border-[var(--text-primary)]/30 transition-colors duration-200"
        {...rest}
      />
    </label>
  )
}
