// Presentation only: injected into the current-cycle print document.
export const currentAppraisalReportStyles = `
  @page { size: A4; margin: 12mm 8mm; }
  body { font-family: Arial, "Helvetica Neue", Helvetica, sans-serif; font-size: 10px; line-height: 1.45; color: #202020; }
  h1 { font-family: inherit; font-size: 13px; line-height: 1.3; letter-spacing: .35px; color: #111; }
  h2 { font-size: 10.5px; line-height: 1.4; font-weight: 700; color: #444; margin-top: 5px; }
  h3 { font-size: 10.5px !important; line-height: 1.35; color: #222; margin: 13px 0 6px; }
  h3[style*="background"] { text-align: center !important; background: #fff !important; color: #111 !important; border: 0 !important; border-top: 1px solid #555 !important; border-bottom: 1px solid #b8b8b8 !important; padding: 7px 0 !important; margin: 17px 0 10px !important; letter-spacing: .45px; }
  table { border: 0 !important; margin-bottom: 12px; font-family: Arial, "Helvetica Neue", Helvetica, sans-serif; font-size: 10px; font-variant-numeric: tabular-nums; }
  th, td { border: 1px solid #cecece !important; padding: 4px 6px; font-size: 10px !important; line-height: 1.35; }
  th { background: #f3f3f3 !important; color: #222; font-size: 10px; font-weight: 700; line-height: 1.35; vertical-align: middle; }
  td { color: #202020; }
  .tr, .tr td { background: #fafafa !important; font-weight: 700; color: #111; }
  .ht { border: 0 !important; border-bottom: 2px solid #444 !important; margin-bottom: 14px; }
  .ht td { padding: 0 5px 10px; background: #fff !important; }
  .ht + table { margin-bottom: 16px; }
  .ht + table td { border-left: 0 !important; border-right: 0 !important; padding: 7px 9px; }
  .ht + table td:first-child { background: #fff !important; color: #444; font-size: 10px; }
  .st { border: 1px solid #aaa !important; }
  .st th { background: #ededed !important; color: #111; }
  .st .tr td, .st tr[style*="background:#bfbfbf"] td { background: #f0f0f0 !important; color: #111 !important; }
  .remarks { border: 1px solid #cecece !important; padding: 10px 12px; line-height: 1.5; }
  .declaration-table td { color: #333; line-height: 1.5; padding: 6px 0; }
  @media screen { body { max-width: 194mm; margin: 24px auto; padding: 12px; box-shadow: 0 3px 24px rgba(15,23,42,.08); } }
  @media print { body { margin: 0; padding: 0; box-shadow: none; } }
`;
