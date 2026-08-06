type BrandMarkProps = {
  className?: string;
  as?: "span" | "p" | "h1" | "div";
};

/** Brand lockup: rePERP (re lowercase, PERP uppercase). */
export function BrandMark({ className = "", as: Tag = "span" }: BrandMarkProps) {
  return (
    <Tag className={`brand-mark ${className}`.trim()} aria-label="rePERP">
      <span className="normal-case">re</span>
      <span className="uppercase">PERP</span>
    </Tag>
  );
}
