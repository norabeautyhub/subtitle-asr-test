const ENGINE_LABEL = {
  elevenlabs: 'ElevenLabs AI (හොඳම සිංහල quality)',
  elevenlabs_byok: 'ඔයාගේම ElevenLabs API key එක',
};

export default function PlanCard({ plan, current = false, children }) {
  return (
    <div className={`card plan ${current ? 'current' : ''}`}>
      {current && <div className="badge">ඔයාගේ plan එක</div>}
      <h3>{plan.name}</h3>
      <p className="muted">{plan.description}</p>
      {plan.price_lkr > 0 && <div className="price">Rs. {plan.price_lkr.toLocaleString()}<span>/මාසෙට</span></div>}
      <ul className="features">
        <li>{plan.unlimited ? 'Minutes limit නෑ' : plan.monthly_minutes > 0 ? `මාසෙට විනාඩි ${plan.monthly_minutes}` : 'Minutes credits වලින්'}</li>
        <li>{ENGINE_LABEL[plan.engine] || plan.engine}</li>
        <li>උපරිම video දිග: විනාඩි {Math.round(plan.max_video_seconds / 60)}</li>
        <li>Export: {plan.export_quality.toUpperCase()}</li>
        <li>{plan.watermark ? 'Watermark එක්ක' : 'Watermark නෑ'}</li>
        <li>{plan.render_mode === 'server' ? 'Server render (tab එක close කරන්න පුළුවන්)' : 'Browser render'}</li>
      </ul>
      {children}
    </div>
  );
}
