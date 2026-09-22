import { GraduationCap } from "lucide-react";
import "./facultyInfoSection.css";

export default function FacultyInfoSection({ info = {}, rows }) {
  const fields = rows || [
    ["Academic Year", info.ay],
    ["Name", info.name],
    ["Qualification", info.qual],
    ["Designation", info.desig],
    ["School", info.school],
    ["Experience", info.experience],
  ];
  return (
    <section className="review-faculty-info-card" aria-label="Faculty Information">
      <header className="review-faculty-info-card__title">
        <span className="review-faculty-info-card__icon"><GraduationCap size={18} aria-hidden="true" /></span>
        <h3>Faculty Information</h3>
      </header>
      <div className="review-faculty-info-card__body">
        <div className="review-faculty-info-card__table-frame">
          <table aria-label="Faculty details">
            <tbody>
              {fields.map(([label, value]) => (
                <tr key={label}>
                  <th scope="row">{label}</th>
                  <td>{value || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
