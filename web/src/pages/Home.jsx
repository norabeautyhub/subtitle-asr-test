import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { Link, useSession } from '../App.jsx';
import PlanCard, { CurrencyToggle, saveCurrency, savedCurrency } from '../components/PlanCard.jsx';

export default function Home() {
  const { user } = useSession();
  const [plans, setPlans] = useState([]);
  const [cur, setCur] = useState(savedCurrency);
  const pickCur = c => { setCur(c); saveCurrency(c); };
  useEffect(() => { api('/plans').then(d => setPlans(d.plans)).catch(() => {}); }, []);

  return (
    <>
      <section className="hero">
        <h1>Video එක upload කරන්න.<br /><span className="grad">සිංහල subtitles auto.</span></h1>
        <p className="lead">
          ඔයාගේ video එකේ කියවෙන හැම වචනයක්ම හරියටම ඒ වෙලාවට screen එකේ — සිංහල සහ English.
          Fonts, colors, animations ඔක්කොම ඔයාට කැමති විදිහට.
        </p>
        <div className="row center-row">
          <Link to={user ? '/dashboard' : '/register'} className="btn lg">{user ? 'Dashboard එකට' : 'නොමිලේ පටන් ගන්න'}</Link>
        </div>
      </section>

      <section>
        <h2 className="section-title">Plans</h2>
        <div className="row center-row"><CurrencyToggle value={cur} onChange={pickCur} /></div>
        <div className="plans">
          {plans.map(p => <PlanCard key={p.id} plan={p} currency={cur} />)}
        </div>
      </section>
    </>
  );
}
