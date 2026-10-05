/**
 * The design's building blocks, as React components.
 *
 * Each one corresponds to a helper in the prototype — `badge()`, `B()`,
 * `tabs()`, `foot()`, `fld()`, `sec()`, `dlGrid()`, `empty()`, `sumKV()` and so
 * on — and emits the same markup and class names, so design-system.css styles
 * them without modification.
 */
import {
  createContext, useContext, useId, useState, type ReactNode, type InputHTMLAttributes,
} from 'react';
import { Link } from 'react-router-dom';
import { badgeClass, nf } from '@erp/shared';

/* --------------------------------- Icon ---------------------------------- */

/** Material Symbols Outlined ligature, as `<span class="ms">`. */
export const Ms = ({ name, size, className = '' }: { name: string; size?: number; className?: string }) => (
  <span className={`ms ${className}`} style={size ? { fontSize: size } : undefined} aria-hidden="true">
    {name}
  </span>
);

/* -------------------------------- Badge ---------------------------------- */

/** Status pill. Colour comes from the shared BADGE_CLASS map. */
export const Badge = ({ status }: { status: string | null | undefined }) =>
  status ? <span className={`badge ${badgeClass(status)}`}>{status}</span> : <span className="sub">—</span>;

/* -------------------------------- Button --------------------------------- */

type ButtonProps = {
  variant?: 'primary' | 'outline' | 'ghost' | 'danger';
  icon?: string;
  children: ReactNode;
  to?: string;
  loading?: boolean;
} & Omit<InputHTMLAttributes<HTMLButtonElement>, 'children' | 'size'>;

export function Button({
  variant = 'outline', icon, children, to, loading, disabled, ...rest
}: ButtonProps) {
  const cls = `btn btn-${variant}`;
  const inner = (
    <>
      {loading ? <Ms name="progress_activity" /> : icon ? <Ms name={icon} /> : null}
      {children}
    </>
  );
  if (to) return <Link className={cls} to={to}>{inner}</Link>;
  return (
    <button className={cls} disabled={disabled || loading} {...(rest as object)}>
      {inner}
    </button>
  );
}

/** Icon-only action button for table row actions. */
export const IconButton = ({
  icon, label, onClick, to,
}: { icon: string; label: string; onClick?: () => void; to?: string }) => {
  const inner = <><Ms name={icon} /><span className="sr-only">{label}</span></>;
  return to ? (
    <Link className="icon-btn" to={to} aria-label={label} onClick={(e) => e.stopPropagation()}>{inner}</Link>
  ) : (
    <button
      className="icon-btn"
      aria-label={label}
      onClick={(e) => { e.stopPropagation(); onClick?.(); }}
    >{inner}</button>
  );
};

/* ------------------------------ Page header ------------------------------ */

export type Crumb = { label: string; to?: string };

export const Crumbs = ({ items }: { items: Crumb[] }) => (
  <div className="crumbs">
    {items.map((c, i) =>
      i < items.length - 1 ? (
        <span key={i}>
          {c.to ? <Link to={c.to}>{c.label}</Link> : <a>{c.label}</a>}
          <span>/</span>
        </span>
      ) : (
        <span key={i}>{c.label}</span>
      ),
    )}
  </div>
);

export const PageHeader = ({
  crumbs, title, subtitle, actions,
}: { crumbs: Crumb[]; title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) => (
  <>
    <Crumbs items={crumbs} />
    <div className="ptitle-row">
      <h1 className="ptitle">
        {title}
        {subtitle ? <small>{subtitle}</small> : null}
      </h1>
      <div className="actions">{actions}</div>
    </div>
  </>
);

/* --------------------------------- Tabs ---------------------------------- */

export type TabDef = { label: string; count?: number };

export const Tabs = ({
  tabs, active, onChange,
}: { tabs: TabDef[]; active: number; onChange: (i: number) => void }) => (
  <div className="tabs" role="tablist">
    {tabs.map((t, i) => (
      <button
        key={t.label}
        role="tab"
        aria-selected={i === active}
        className={`tab ${i === active ? 'active' : ''}`}
        onClick={() => onChange(i)}
      >
        {t.label}
        {t.count != null ? <span className="count">{t.count}</span> : null}
      </button>
    ))}
  </div>
);

/* --------------------------------- Cards --------------------------------- */

export const Card = ({
  children, bodyPadded, className = '',
}: { children: ReactNode; bodyPadded?: boolean; className?: string }) => (
  <div className={`card ${bodyPadded ? 'card-b' : ''} ${className}`}>{children}</div>
);

export const CardHead = ({ title, children }: { title: ReactNode; children?: ReactNode }) => (
  <div className="card-h">
    <h2>{title}</h2>
    {children}
  </div>
);

export const SectionTitle = ({ children }: { children: ReactNode }) => (
  <p className="section-t">{children}</p>
);

/** `sec()` — a titled form section with an icon. */
export const FormSection = ({
  icon, title, children,
}: { icon: string; title: string; children: ReactNode }) => (
  <div className="form-sec">
    <h3><Ms name={icon} />{title}</h3>
    {children}
  </div>
);

export const FormGrid = ({ children }: { children: ReactNode }) => (
  <div className="form-grid">{children}</div>
);

/** The two-column `split` (main + right summary stack) used on nearly every page. */
export const Split = ({ main, aside }: { main: ReactNode; aside?: ReactNode }) =>
  aside ? (
    <div className="split">
      <div>{main}</div>
      <div className="stack">{aside}</div>
    </div>
  ) : (
    <>{main}</>
  );

/* ------------------------------ Definition list -------------------------- */

/** `dlGrid()` — read-only key/value grid on detail Overview tabs. */
export const DescriptionGrid = ({ items }: { items: [string, ReactNode][] }) => (
  <div className="dl">
    {items.map(([k, v], i) => (
      <div key={i}>
        <div className="k">{k}</div>
        <div className="v">{v ?? '—'}</div>
      </div>
    ))}
  </div>
);

/** `sumKV()` — compact key/value pair in the right-hand summary card. */
export const SummaryGrid = ({ items }: { items: [string, ReactNode][] }) => (
  <div className="sum-grid">
    {items.map(([k, v], i) => (
      <div key={i}>
        <span className="k">{k}</span>
        <span className="v">{v ?? '—'}</span>
      </div>
    ))}
  </div>
);

export const BigStat = ({
  value, secondary, note,
}: { value: ReactNode; secondary?: ReactNode; note?: string }) => (
  <div className="bigstat" style={{ marginBottom: 14 }}>
    <b>{value}</b>
    {secondary ? <span>{secondary}</span> : null}
    {note ? <div className="kbd-note">{note}</div> : null}
  </div>
);

/** `legend()` — a coloured dot, icon and label in a summary card. */
export const Legend = ({
  tone, icon, label,
}: { tone: string; icon: string; label: string }) => (
  <div className="legend-row">
    <span className="dot" style={{ background: `var(${tone})` }} />
    <Ms name={icon} />
    <span>{label}</span>
  </div>
);

/** Horizontal bar used in "X by Y" summary cards. */
export const BarRow = ({
  label, value, max, tone,
}: { label: string; value: number; max: number; tone?: string }) => (
  <div className="bar-h">
    <span>{label}</span>
    <div className="track">
      <div
        className="fill"
        style={{ width: `${max > 0 ? Math.min(100, (value / max) * 100) : 0}%`, ...(tone ? { background: tone } : {}) }}
      />
    </div>
    <span className="num r">{nf.format(value)}</span>
  </div>
);

/** `lifeBar()` — tool life consumed, with the design's colour thresholds. */
export const LifeBar = ({ pct, tone }: { pct: number; tone: string }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 150 }}>
    <div className="track" style={{ flex: 1, height: 8, background: 'var(--surface-2)', borderRadius: 4, overflow: 'hidden' }}>
      <div style={{ width: `${pct}%`, height: '100%', background: tone }} />
    </div>
    <span className="num" style={{ fontSize: 12, color: 'var(--fg-2)', width: 34 }}>{pct}%</span>
  </div>
);

/* ------------------------------ Empty / alert ---------------------------- */

export const Empty = ({
  icon, title, body, action,
}: { icon: string; title: string; body?: string; action?: ReactNode }) => (
  <div className="empty">
    <Ms name={icon} />
    <h3>{title}</h3>
    {body ? <p>{body}</p> : null}
    {action}
  </div>
);

export const Alert = ({
  tone = 'info', icon, title, children,
}: { tone?: 'info' | 'warn' | 'bad' | 'ok'; icon?: string; title?: string; children?: ReactNode }) => (
  <div className={`alert alert-${tone}`}>
    <Ms name={icon ?? (tone === 'warn' || tone === 'bad' ? 'warning' : 'info')} />
    <div>
      {title ? <b>{title}</b> : null}
      {children}
    </div>
  </div>
);

export const Hint = ({ children }: { children: ReactNode }) => <div className="hint">{children}</div>;

/* -------------------------------- Toolbar -------------------------------- */

export const Toolbar = ({ children }: { children: ReactNode }) => (
  <div className="toolbar">{children}</div>
);

export const SearchField = ({
  value, onChange, placeholder,
}: { value: string; onChange: (v: string) => void; placeholder: string }) => {
  const id = useId();
  return (
    <div className="field-o search">
      <input id={id} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      <Ms name="search" />
    </div>
  );
};

export const SelectField = ({
  label, value, onChange, options, minWidth = 150,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  /** First entry is the "All ..." reset option; its value is ''. */
  options: { value: string; label: string }[];
  minWidth?: number;
}) => {
  const id = useId();
  return (
    <div className="field-o lab" style={{ minWidth }}>
      <label htmlFor={id}>{label}</label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
};

/** Filter chips with counts, driven by the list endpoint's `facets`. */
export const Chips = ({
  options, active, onChange,
}: {
  options: { value: string; label: string; count?: number }[];
  active: string;
  onChange: (v: string) => void;
}) => (
  <div className="chips">
    {options.map((o) => (
      <button
        key={o.value}
        className={`chip ${active === o.value ? 'on' : ''}`}
        onClick={() => onChange(o.value)}
        aria-pressed={active === o.value}
      >
        {o.label}{o.count != null ? ` · ${o.count}` : ''}
      </button>
    ))}
  </div>
);

/** Segmented List/Cards switch in a card header. */
export const Segmented = ({
  options, active, onChange,
}: { options: string[]; active: string; onChange: (v: string) => void }) => (
  <div className="seg">
    {options.map((o) => (
      <button key={o} className={active === o ? 'on' : ''} onClick={() => onChange(o)}>{o}</button>
    ))}
  </div>
);

/* ------------------------------ Table footer ----------------------------- */

export const TableFooter = ({
  page, pageSize, total, onPage, onPageSize,
}: {
  page: number; pageSize: number; total: number;
  onPage: (p: number) => void; onPageSize?: (n: number) => void;
}) => {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  // Window the pager around the current page so a 400-page register does not
  // render 400 buttons.
  const windowSize = 3;
  const start = Math.max(1, Math.min(page - 1, pages - windowSize + 1));
  const shown = Array.from({ length: Math.min(windowSize, pages) }, (_, i) => start + i);

  return (
    <div className="tbl-foot">
      <span>Showing {from}–{to} of {nf.format(total)}</span>
      <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
        {onPageSize ? (
          <span>
            Rows per page:{' '}
            <select
              value={pageSize}
              onChange={(e) => onPageSize(Number(e.target.value))}
              style={{ border: 0, background: 'none', font: 'inherit', fontWeight: 700, cursor: 'pointer' }}
              aria-label="Rows per page"
            >
              {[25, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </span>
        ) : null}
        <div className="pager">
          <button aria-label="Previous" disabled={page <= 1} onClick={() => onPage(page - 1)}>
            <Ms name="chevron_left" />
          </button>
          {shown.map((p) => (
            <button key={p} className={p === page ? 'on' : ''} onClick={() => onPage(p)} aria-current={p === page}>
              {p}
            </button>
          ))}
          <button aria-label="Next" disabled={page >= pages} onClick={() => onPage(page + 1)}>
            <Ms name="chevron_right" />
          </button>
        </div>
      </div>
    </div>
  );
};

/* --------------------------------- Files --------------------------------- */

export const Dropzone = ({
  hint, onFiles,
}: { hint: string; onFiles?: (files: FileList) => void }) => {
  const [over, setOver] = useState(false);
  const id = useId();
  return (
    <label
      htmlFor={id}
      className={`drop ${over ? 'over' : ''}`}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); onFiles?.(e.dataTransfer.files); }}
    >
      <Ms name="cloud_upload" />
      <div>
        <b>Drop files here or browse</b>
        <span>{hint}</span>
      </div>
      <input
        id={id}
        type="file"
        multiple
        style={{ display: 'none' }}
        onChange={(e) => e.target.files && onFiles?.(e.target.files)}
      />
    </label>
  );
};

/**
 * `fileRow()` — an attached file. The inner structure is `.ext` + `.meta` with
 * two child divs, because design-system.css styles the meta lines by position
 * (`.file .meta div:first-child` / `:last-child`), not by class.
 */
export const FileRow = ({
  name, meta, kind, tone,
}: { name: string; meta: string; kind: string; tone: string }) => (
  <div className="file">
    <span className="ext" style={{ background: tone }}>{kind}</span>
    <div className="meta">
      <div>{name}</div>
      <div>{meta}</div>
    </div>
    <IconButton icon="download" label={`Download ${name}`} />
  </div>
);

/* ------------------------------- Timeline -------------------------------- */

export type TimelineItem = { title: string; detail?: string; state?: 'done' | 'now' };

export const Timeline = ({ items }: { items: TimelineItem[] }) => (
  <ul className="tl">
    {items.map((it, i) => (
      <li key={i} className={it.state ?? ''}>
        <div className="t">{it.title}</div>
        {it.detail ? <div className="d">{it.detail}</div> : null}
      </li>
    ))}
  </ul>
);

export const Stepper = ({ steps, current }: { steps: string[]; current: number }) => (
  <div className="stepper">
    {steps.map((s, i) => (
      <div key={s} className={`step ${i < current ? 'done' : i === current ? 'now' : ''}`}>
        <span className="dot">{i < current ? <Ms name="check" size={16} /> : i + 1}</span>
        <span className="lbl">{s}</span>
      </div>
    ))}
  </div>
);

/* --------------------------------- Toasts -------------------------------- */

type Toast = { id: number; message: string; tone?: 'ok' | 'bad' };
const ToastCtx = createContext<(message: string, tone?: 'ok' | 'bad') => void>(() => {});

export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = (message: string, tone?: 'ok' | 'bad') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  };

  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.tone ?? ''}`}>{t.message}</div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

/* --------------------------------- Mono ---------------------------------- */

export const Mono = ({ children }: { children: ReactNode }) => <span className="mono">{children}</span>;

export const MonoLink = ({ to, children }: { to: string; children: ReactNode }) => (
  <Link className="link mono" to={to} onClick={(e) => e.stopPropagation()}>{children}</Link>
);

/** Primary cell: bold name over a muted sub-line. */
export const CellStack = ({ main, sub, subMono }: { main: ReactNode; sub?: ReactNode; subMono?: boolean }) => (
  <>
    <b>{main}</b>
    {sub ? <span className={`sub ${subMono ? 'mono' : ''}`}>{sub}</span> : null}
  </>
);
