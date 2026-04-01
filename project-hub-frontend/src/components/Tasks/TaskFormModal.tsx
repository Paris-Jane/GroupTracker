import { useState } from 'react';
import type { TaskItem, GroupMember, TaskPriority, TaskStatus, TaskCategory, CreateTaskDto } from '../../types';
import MemberSelector from '../common/MemberSelector';

const PRIORITIES: TaskPriority[] = ['High', 'Medium', 'Low'];
const CATEGORIES: TaskCategory[] = ['ProductBacklog', 'SprintGoal', 'SprintBacklog', 'Other'];

export interface TaskFormModalProps {
  task?: TaskItem;
  members: GroupMember[];
  onSave: (data: CreateTaskDto & { assigneeIds: number[]; subtaskNames: string[] }) => void;
  onClose: () => void;
}

export default function TaskFormModal({ task, members, onSave, onClose }: TaskFormModalProps) {
  const [name, setName] = useState(task?.name ?? '');
  const [notes, setNotes] = useState(task?.notes ?? '');
  const [estimatedTime, setEstimatedTime] = useState(task?.estimatedTime ?? '');
  const [deadline, setDeadline] = useState(task?.deadline ? task.deadline.split('T')[0] : '');
  const [priority, setPriority] = useState<TaskPriority>(task?.priority ?? 'Medium');
  const [isRequired, setIsRequired] = useState(task?.isRequired ?? true);
  const [status, setStatus] = useState<TaskStatus>(task?.status ?? 'NotStarted');
  const [tags, setTags] = useState(task?.tags ?? '');
  const [sprintNumber, setSprintNumber] = useState(task?.sprintNumber != null ? String(task.sprintNumber) : '');
  const [category, setCategory] = useState<TaskCategory>(task?.category ?? 'ProductBacklog');
  const [evaluation, setEvaluation] = useState(task?.evaluation != null ? String(task.evaluation) : '');
  const [definitionOfDone, setDefinitionOfDone] = useState(task?.definitionOfDone ?? '');
  const [assigneeIds, setAssigneeIds] = useState<number[]>(task?.assignments.map(a => a.groupMemberId) ?? []);
  const [subtaskNames, setSubtaskNames] = useState<string[]>(task?.subtasks.map(s => s.name) ?? []);
  const [newSubtask, setNewSubtask] = useState('');

  const addSubtask = () => {
    if (newSubtask.trim()) {
      setSubtaskNames([...subtaskNames, newSubtask.trim()]);
      setNewSubtask('');
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal modal-lg">
        <div className="modal-header">
          <span className="modal-title">{task ? 'Edit task' : 'New task'}</span>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="modal-body">
          <div className="form-row">
            <label>Task name *</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Write project report" />
          </div>
          <div className="form-row">
            <label>Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Details, context, links…" />
          </div>
          <div className="form-grid mb-3">
            <div>
              <label>Estimated time</label>
              <input value={estimatedTime} onChange={e => setEstimatedTime(e.target.value)} placeholder="e.g. 2 hours" />
            </div>
            <div>
              <label>Deadline</label>
              <input type="date" value={deadline} onChange={e => setDeadline(e.target.value)} />
            </div>
          </div>
          <div className="form-grid mb-3">
            <div>
              <label>Priority</label>
              <select value={priority} onChange={e => setPriority(e.target.value as TaskPriority)}>
                {PRIORITIES.map(p => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label>Status</label>
              <select value={status} onChange={e => setStatus(e.target.value as TaskStatus)}>
                <option value="NotStarted">Not started</option>
                <option value="InProgress">In progress</option>
                <option value="Completed">Completed</option>
              </select>
            </div>
          </div>
          <div className="form-grid mb-3">
            <div>
              <label>Sprint number</label>
              <input type="number" min={0} value={sprintNumber} onChange={e => setSprintNumber(e.target.value)} placeholder="Optional" />
            </div>
            <div>
              <label>Category</label>
              <select value={category} onChange={e => setCategory(e.target.value as TaskCategory)}>
                {CATEGORIES.map(c => (
                  <option key={c} value={c}>
                    {c.replace(/([A-Z])/g, ' $1').trim()}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="form-grid mb-3">
            <div>
              <label>Evaluation (poker points)</label>
              <input type="number" min={0} value={evaluation} onChange={e => setEvaluation(e.target.value)} placeholder="Optional" />
            </div>
            <div>
              <label>Definition of done</label>
              <input value={definitionOfDone} onChange={e => setDefinitionOfDone(e.target.value)} placeholder="When is this task done?" />
            </div>
          </div>
          <div className="form-grid mb-3">
            <div>
              <label>Tags</label>
              <input value={tags} onChange={e => setTags(e.target.value)} placeholder="e.g. Design, Backend" />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', paddingTop: 20 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontWeight: 400 }}>
                <input type="checkbox" checked={isRequired} onChange={e => setIsRequired(e.target.checked)} style={{ width: 'auto' }} />
                Required task
              </label>
            </div>
          </div>
          <div className="form-row">
            <MemberSelector members={members} selected={assigneeIds} onChange={setAssigneeIds} />
          </div>
          <div className="form-row">
            <label>Subtasks</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}>
              {subtaskNames.map((s, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ flex: 1, fontSize: 13 }}>{s}</span>
                  <button type="button" className="btn btn-ghost btn-xs" onClick={() => setSubtaskNames(subtaskNames.filter((_, j) => j !== i))}>
                    Remove
                  </button>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                value={newSubtask}
                onChange={e => setNewSubtask(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addSubtask()}
                placeholder="Add subtask…"
              />
              <button type="button" className="btn btn-secondary btn-sm" style={{ flexShrink: 0 }} onClick={addSubtask}>
                Add
              </button>
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!name.trim()}
            onClick={() =>
              onSave({
                name,
                notes,
                estimatedTime,
                deadline: deadline || undefined,
                priority,
                isRequired,
                status,
                tags,
                sprintNumber: sprintNumber ? Number(sprintNumber) : undefined,
                category,
                evaluation: evaluation ? Number(evaluation) : undefined,
                definitionOfDone: definitionOfDone || undefined,
                assigneeIds,
                subtaskNames,
              })
            }
          >
            {task ? 'Save' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}
