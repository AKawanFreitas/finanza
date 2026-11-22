import { useId } from 'react';

// Rótulo + controle + dica/erro, ligados por id. Use no lugar de <div class="form-group"><label>.
//   <Field label="Valor" opcional hint="Use ponto ou vírgula">
//     {id => <input id={id} className="form-control" ... />}
//   </Field>
// O controle recebe `id` e `aria-describedby` por props de função, então funciona com
// <input>, <select>, <textarea> e com o <Select> da casa, mesmo dentro de wrappers.
export default function Field({ label, opcional, hint, erro, className = '', children }) {
  const id = useId();
  const nota = erro || hint ? `${id}-nota` : undefined;
  return (
    <div className={`form-group ${className}`.trim()}>
      <label className="form-label" htmlFor={id}>
        {label}
        {opcional && <span className="form-label-opt">(opcional)</span>}
      </label>
      {children(id, { 'aria-describedby': nota, 'aria-invalid': erro ? true : undefined })}
      {(erro || hint) && (
        <small id={nota} className={erro ? 'form-erro' : 'form-hint'} role={erro ? 'alert' : undefined}>{erro || hint}</small>
      )}
    </div>
  );
}

// Rótulo de um grupo de controles (alternador, cores): usa role=group em vez de <label>.
export function FieldGroup({ label, className = '', children }) {
  const id = useId();
  return (
    <div className={`form-group ${className}`.trim()} role="group" aria-labelledby={id}>
      <span className="form-label" id={id}>{label}</span>
      {children}
    </div>
  );
}
