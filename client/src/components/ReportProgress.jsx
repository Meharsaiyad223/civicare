import { Check, Clock3, Wrench } from 'lucide-react';

const steps = ['Reported', 'Assigned', 'In progress', 'Completed'];

function progressDetails(order) {
  if (!order) return {
    completedCount: 1,
    currentStep: 1,
    title: 'Pending city assignment',
    detail: 'The city has received your complaint. A contractor has not been assigned yet.',
  };
  if (order.status === 'assigned') return {
    completedCount: 3,
    currentStep: 3,
    title: 'In progress',
    detail: `${order.contractor?.name || 'A contractor'} received the task from ${order.assignedBy?.name || 'the city officer'}.`,
  };
  if (order.status === 'completion_submitted') return {
    completedCount: 4,
    currentStep: -1,
    title: 'Contractor completed the task',
    detail: `${order.contractor?.name || 'The contractor'} marked this work complete.`,
  };
  return {
    completedCount: 4,
    currentStep: -1,
    title: 'Contractor completed the task',
    detail: `${order.contractor?.name || 'The contractor'} marked this work complete.`,
  };
}

export default function ReportProgress({ report }) {
  const order = report.workOrder;
  const contractorDone = ['completion_submitted', 'verified'].includes(order?.status);
  const progress = progressDetails(order);
  const progressValue = Math.round((progress.completedCount / steps.length) * 100);
  return (
    <section className="citizen-report-progress" aria-label="Task completion progress">
      <div className="citizen-progress-heading">
        <div><small>COMPLAINT PROGRESS</small><strong>{progress.title}</strong></div>
        {contractorDone && <span className="citizen-contractor-done"><Check size={13} /> Contractor done</span>}
      </div>
      <div className="citizen-progress-track" role="progressbar" aria-label="Complaint completion" aria-valuemin="0" aria-valuemax="100" aria-valuenow={progressValue}>
        <span style={{ width: `${progressValue}%` }} />
      </div>
      <ol className="citizen-progress-steps">
        {steps.map((step, index) => {
          const complete = index < progress.completedCount;
          const current = index === progress.currentStep;
          return <li className={`${complete ? 'step-complete' : ''} ${current ? 'step-current' : ''}`} key={step}>
            <span className="citizen-progress-step-icon">{complete ? <Check size={11} /> : current ? <Clock3 size={11} /> : index === 2 ? <Wrench size={11} /> : index + 1}</span>
            <small>{step}</small>
          </li>;
        })}
      </ol>
      <p className="citizen-progress-detail">{progress.detail}</p>
      {order?.completionNotes && <p className="citizen-progress-note"><strong>Contractor update:</strong> {order.completionNotes}</p>}
      {order?.dueDate && order.status !== 'verified' && <small className="citizen-progress-due">Contractor due date: {new Date(order.dueDate).toLocaleDateString()}</small>}
    </section>
  );
}
