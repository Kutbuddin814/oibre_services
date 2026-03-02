export default function ServiceCard({ provider }) {
  return (
    <div className="card">
      <div className="avatar">
        {provider.name.charAt(0)}
      </div>

      <h3>{provider.name}</h3>
      <p className="skill">{provider.skill}</p>

      <p className="meta">⭐ {provider.rating} • {provider.experience} yrs exp</p>
      <p className="distance">{provider.distance} away</p>

      <button className="primary-btn">Book Service</button>
    </div>
  );
}
