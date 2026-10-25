(() => {
  const section = document.getElementById('admin-private-workspace');
  const tab = [...document.querySelectorAll('.admin-tab')].find(button => button.dataset.adminTab === '15');
  if (!section || !tab || !window.RVCloud) return;

  const statusLine = document.getElementById('admin-workspace-status');
  const overview = document.getElementById('admin-workspace-overview');
  const objectivesHost = document.getElementById('workspace-objectives');
  const tasksHost = document.getElementById('workspace-tasks');
  const reportsHost = document.getElementById('workspace-reports');
  const objectiveForm = document.getElementById('workspace-objective-form');
  const taskForm = document.getElementById('workspace-task-form');
  const reportForm = document.getElementById('workspace-report-form');
  const objectiveSelect = document.getElementById('workspace-task-objective');
  const taskFilter = document.getElementById('workspace-task-filter');
  const refreshButton = document.getElementById('admin-workspace-refresh');
  const statuses = { todo: 'À faire', doing: 'En cours', done: 'Terminée' };
  const priorities = { low: 'Basse', normal: 'Normale', high: 'Haute' };
  let state = { objectives: [], tasks: [], reports: [] };
  let revision = 0;
  let loaded = false;
  let loading = false;
  let saving = false;
  let conflicted = false;

  const makeId = prefix => `${prefix}-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`}`;
  const boundedText = (value, max) => String(value ?? '').trim().slice(0, max);
  const clone = value => JSON.parse(JSON.stringify(value));
  const today = () => new Date().toISOString().slice(0, 10);
  const dateLabel = value => {
    if (!value) return '';
    const date = new Date(`${value}T12:00:00`);
    return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' }).format(date);
  };
  const setStatus = (message, type = 'info') => {
    statusLine.textContent = message;
    statusLine.dataset.state = type;
  };
  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const makeEmpty = message => el('p', 'workspace-empty', message);

  function normalize(payload) {
    const source = payload && typeof payload === 'object' ? payload : {};
    const objectives = Array.isArray(source.objectives) ? source.objectives.slice(0, 100) : [];
    const tasks = Array.isArray(source.tasks) ? source.tasks.slice(0, 300) : [];
    const reports = Array.isArray(source.reports) ? source.reports.slice(0, 100) : [];
    return {
      objectives: objectives.filter(item => item && typeof item === 'object').map(item => ({
        id: boundedText(item.id, 100) || makeId('objective'),
        title: boundedText(item.title, 120),
        description: boundedText(item.description, 1200),
        owner: boundedText(item.owner, 100),
        dueDate: boundedText(item.dueDate, 10),
        status: ['active', 'paused', 'done'].includes(item.status) ? item.status : 'active',
        createdAt: boundedText(item.createdAt, 40)
      })),
      tasks: tasks.filter(item => item && typeof item === 'object').map(item => ({
        id: boundedText(item.id, 100) || makeId('task'),
        title: boundedText(item.title, 140),
        description: boundedText(item.description, 1200),
        assignee: boundedText(item.assignee, 100),
        dueDate: boundedText(item.dueDate, 10),
        priority: ['low', 'normal', 'high'].includes(item.priority) ? item.priority : 'normal',
        status: ['todo', 'doing', 'done'].includes(item.status) ? item.status : 'todo',
        objectiveId: boundedText(item.objectiveId, 100),
        createdAt: boundedText(item.createdAt, 40)
      })),
      reports: reports.filter(item => item && typeof item === 'object').map(item => ({
        id: boundedText(item.id, 100) || makeId('report'),
        title: boundedText(item.title, 140),
        period: boundedText(item.period, 10),
        author: boundedText(item.author, 100),
        summary: boundedText(item.summary, 2000),
        wins: boundedText(item.wins, 1600),
        blockers: boundedText(item.blockers, 1600),
        nextSteps: boundedText(item.nextSteps, 1600),
        createdAt: boundedText(item.createdAt, 40)
      }))
    };
  }

  function updateOverview() {
    overview.replaceChildren();
    const pending = state.tasks.filter(task => task.status !== 'done').length;
    const finished = state.tasks.filter(task => task.status === 'done').length;
    const activeObjectives = state.objectives.filter(goal => goal.status !== 'done').length;
    [
      ['Tâches à suivre', String(pending)],
      ['Tâches terminées', String(finished)],
      ['Objectifs actifs', String(activeObjectives)],
      ['Comptes rendus', String(state.reports.length)]
    ].forEach(([label, value]) => {
      const card = el('article', 'workspace-metric');
      card.append(el('span', '', label), el('strong', '', value));
      overview.append(card);
    });
  }

  function updateObjectiveSelect() {
    const selected = objectiveSelect.value;
    objectiveSelect.replaceChildren(new Option('Aucun objectif', ''));
    state.objectives.filter(goal => goal.status !== 'done').forEach(goal => {
      objectiveSelect.add(new Option(goal.title || 'Objectif sans titre', goal.id));
    });
    objectiveSelect.value = state.objectives.some(goal => goal.id === selected) ? selected : '';
  }

  function renderObjectives() {
    objectivesHost.replaceChildren();
    updateObjectiveSelect();
    if (!state.objectives.length) {
      objectivesHost.append(makeEmpty('Aucun objectif pour le moment. Crée un premier objectif ci-dessus.'));
      return;
    }
    state.objectives.forEach(goal => {
      const card = el('article', 'workspace-item workspace-objective');
      card.dataset.objectiveCard = 'true';
      card.dataset.id = goal.id;
      const heading = el('div', 'workspace-item-heading');
      heading.append(el('h4', '', goal.title || 'Objectif sans titre'));
      const progressTasks = state.tasks.filter(task => task.objectiveId === goal.id);
      const percent = progressTasks.length ? Math.round(progressTasks.filter(task => task.status === 'done').length / progressTasks.length * 100) : 0;
      const progressLabel = el('div', 'workspace-progress-label');
      progressLabel.append(el('span', '', `${progressTasks.filter(task => task.status === 'done').length} tâche(s) terminée(s) sur ${progressTasks.length}`), el('strong', '', `${percent} %`));
      const bar = el('div', 'workspace-progress');
      bar.setAttribute('role', 'progressbar');
      bar.setAttribute('aria-label', `Avancement de l’objectif ${goal.title || ''}`);
      bar.setAttribute('aria-valuemin', '0');
      bar.setAttribute('aria-valuemax', '100');
      bar.setAttribute('aria-valuenow', String(percent));
      const fill = el('span');
      fill.style.width = `${percent}%`;
      bar.append(fill);
      card.append(heading);
      if (goal.description) card.append(el('p', 'workspace-item-description', goal.description));
      const meta = [goal.owner ? `Responsable : ${goal.owner}` : '', goal.dueDate ? `Échéance : ${dateLabel(goal.dueDate)}` : ''].filter(Boolean).join(' · ');
      if (meta) card.append(el('p', 'workspace-item-meta', meta));
      card.append(progressLabel, bar);
      const actions = el('div', 'workspace-item-actions');
      const statusSelect = el('select', 'workspace-inline-select');
      statusSelect.setAttribute('aria-label', `État de l’objectif ${goal.title}`);
      [['active', 'En cours'], ['paused', 'En pause'], ['done', 'Terminé']].forEach(([value, label]) => statusSelect.add(new Option(label, value)));
      statusSelect.value = goal.status;
      const remove = el('button', 'workspace-delete', 'Supprimer');
      remove.type = 'button';
      remove.dataset.action = 'delete-objective';
      actions.append(statusSelect, remove);
      card.append(actions);
      objectivesHost.append(card);
    });
  }

  function renderTasks() {
    tasksHost.replaceChildren();
    const filter = taskFilter.value;
    const tasks = state.tasks.filter(task => filter === 'all' || task.status === filter).slice().sort((a, b) => {
      if (a.status === 'done' && b.status !== 'done') return 1;
      if (b.status === 'done' && a.status !== 'done') return -1;
      return (a.dueDate || '9999').localeCompare(b.dueDate || '9999');
    });
    if (!tasks.length) {
      tasksHost.append(makeEmpty(filter === 'all' ? 'Aucune tâche pour le moment. Crée une première action ci-dessus.' : 'Aucune tâche dans ce filtre.'));
      return;
    }
    tasks.forEach(task => {
      const card = el('article', `workspace-item workspace-task${task.status === 'done' ? ' is-complete' : ''}`);
      card.dataset.taskCard = 'true';
      card.dataset.id = task.id;
      const heading = el('div', 'workspace-item-heading');
      heading.append(el('h4', '', task.title || 'Tâche sans titre'));
      heading.append(el('span', `workspace-priority priority-${task.priority}`, priorities[task.priority]));
      if (task.description) card.append(el('p', 'workspace-item-description', task.description));
      const goal = state.objectives.find(item => item.id === task.objectiveId);
      const meta = [task.assignee ? `Responsable : ${task.assignee}` : '', task.dueDate ? `Échéance : ${dateLabel(task.dueDate)}` : '', goal ? `Objectif : ${goal.title}` : ''].filter(Boolean).join(' · ');
      if (meta) card.append(el('p', 'workspace-item-meta', meta));
      const actions = el('div', 'workspace-item-actions');
      const statusSelect = el('select', 'workspace-inline-select');
      statusSelect.setAttribute('aria-label', `État de la tâche ${task.title}`);
      Object.entries(statuses).forEach(([value, label]) => statusSelect.add(new Option(label, value)));
      statusSelect.value = task.status;
      const remove = el('button', 'workspace-delete', 'Supprimer');
      remove.type = 'button';
      remove.dataset.action = 'delete-task';
      actions.append(statusSelect, remove);
      card.append(heading, actions);
      tasksHost.append(card);
    });
  }

  function renderReports() {
    reportsHost.replaceChildren();
    if (!state.reports.length) {
      reportsHost.append(makeEmpty('Aucun compte rendu pour le moment.'));
      return;
    }
    state.reports.slice().sort((a, b) => (b.period || b.createdAt).localeCompare(a.period || a.createdAt)).forEach(report => {
      const card = el('article', 'workspace-item workspace-report');
      card.dataset.reportCard = 'true';
      card.dataset.id = report.id;
      const heading = el('div', 'workspace-item-heading');
      heading.append(el('h4', '', report.title || 'Compte rendu sans titre'));
      heading.append(el('span', 'workspace-report-date', dateLabel(report.period)));
      card.append(heading);
      if (report.author) card.append(el('p', 'workspace-item-meta', `Rédigé par ${report.author}`));
      card.append(el('p', 'workspace-report-summary', report.summary));
      [['Avancées', report.wins], ['Blocages', report.blockers], ['Prochaines étapes', report.nextSteps]].forEach(([label, value]) => {
        if (!value) return;
        const detail = el('div', 'workspace-report-detail');
        detail.append(el('strong', '', label), el('p', '', value));
        card.append(detail);
      });
      const actions = el('div', 'workspace-item-actions');
      const remove = el('button', 'workspace-delete', 'Supprimer ce compte rendu');
      remove.type = 'button';
      remove.dataset.action = 'delete-report';
      actions.append(remove);
      card.append(actions);
      reportsHost.append(card);
    });
  }

  function render() {
    updateOverview();
    renderObjectives();
    renderTasks();
    renderReports();
  }

  async function loadWorkspace() {
    if (loading || saving) return;
    loading = true;
    refreshButton.disabled = true;
    setStatus('Chargement de l’espace privé…');
    try {
      const record = await window.RVCloud.loadAdminWorkspace();
      state = normalize(record.payload);
      revision = Number(record.revision);
      loaded = true;
      conflicted = false;
      render();
      setStatus(`Espace synchronisé · dernière mise à jour ${new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(record.updated_at))}.`);
    } catch (error) {
      console.error('Espace privé admin indisponible.', error);
      const detail = String(error?.message || 'Erreur inconnue');
      loaded = false;
      if (/PGRST205|PGRST204|42P01|404/i.test(detail)) {
        setStatus('La table privée n’est pas encore créée. Dans Supabase → SQL Editor, exécute une fois le fichier supabase/admin-workspace.sql, puis recharge cette rubrique.', 'error');
      } else if (/Espace privé indisponible/i.test(detail)) {
        setStatus('Espace privé introuvable : exécute supabase/admin-workspace.sql dans Supabase, puis vérifie que ton compte est dans private.site_admins.', 'error');
      } else if (/42501|row-level security|Aucun accès/i.test(detail)) {
        setStatus('Accès réservé aux admins. Vérifie que ton compte figure dans private.site_admins.', 'error');
      } else {
        setStatus(`Impossible de charger l’espace privé : ${detail.slice(0, 180)}`, 'error');
      }
    } finally {
      loading = false;
      refreshButton.disabled = false;
    }
  }

  async function commit(next, successMessage) {
    if (!loaded || saving || conflicted) return false;
    if (next.objectives.length > 100 || next.tasks.length > 300 || next.reports.length > 100 || JSON.stringify(next).length > 450000) {
      setStatus('La limite de capacité de l’espace privé est atteinte. Archive ou supprime d’anciens éléments avant de continuer.', 'error');
      return false;
    }
    saving = true;
    section.setAttribute('aria-busy', 'true');
    setStatus('Enregistrement privé en cours…');
    try {
      const record = await window.RVCloud.saveAdminWorkspace(next, revision);
      state = normalize(record.payload);
      revision = Number(record.revision);
      render();
      setStatus(successMessage || 'Enregistré et synchronisé entre les comptes admin.');
      return true;
    } catch (error) {
      console.error('Échec de sauvegarde de l’espace privé.', error);
      const detail = String(error?.message || 'Erreur inconnue');
      if (/modifié par un autre admin/i.test(detail)) conflicted = true;
      setStatus(`Sauvegarde impossible : ${detail.slice(0, 190)}`, 'error');
      return false;
    } finally {
      saving = false;
      section.removeAttribute('aria-busy');
    }
  }

  function values(form) {
    return Object.fromEntries(new FormData(form).entries());
  }

  objectiveForm.addEventListener('submit', async event => {
    event.preventDefault();
    const fields = values(objectiveForm);
    const next = clone(state);
    next.objectives.unshift({ id: makeId('objective'), title: boundedText(fields.title, 120), description: boundedText(fields.description, 1200), owner: boundedText(fields.owner, 100), dueDate: boundedText(fields.dueDate, 10), status: 'active', createdAt: new Date().toISOString() });
    if (await commit(next, 'Objectif créé et partagé entre les admins.')) objectiveForm.reset();
  });

  taskForm.addEventListener('submit', async event => {
    event.preventDefault();
    const fields = values(taskForm);
    const next = clone(state);
    next.tasks.unshift({ id: makeId('task'), title: boundedText(fields.title, 140), description: boundedText(fields.description, 1200), assignee: boundedText(fields.assignee, 100), dueDate: boundedText(fields.dueDate, 10), priority: ['low', 'normal', 'high'].includes(fields.priority) ? fields.priority : 'normal', status: 'todo', objectiveId: boundedText(fields.objectiveId, 100), createdAt: new Date().toISOString() });
    if (await commit(next, 'Tâche créée et partagée entre les admins.')) taskForm.reset();
  });

  reportForm.addEventListener('submit', async event => {
    event.preventDefault();
    const fields = values(reportForm);
    const next = clone(state);
    next.reports.unshift({ id: makeId('report'), title: boundedText(fields.title, 140), period: boundedText(fields.period, 10), author: boundedText(fields.author, 100) || (window.RVCloud.getAdminEmail().split('@')[0] || 'Équipe admin'), summary: boundedText(fields.summary, 2000), wins: boundedText(fields.wins, 1600), blockers: boundedText(fields.blockers, 1600), nextSteps: boundedText(fields.nextSteps, 1600), createdAt: new Date().toISOString() });
    if (await commit(next, 'Compte rendu enregistré dans l’espace privé.')) {
      reportForm.reset();
      reportForm.elements.period.value = today();
    }
  });

  tasksHost.addEventListener('change', async event => {
    const card = event.target.closest('[data-task-card]');
    if (!card || !event.target.matches('select')) return;
    const next = clone(state);
    const task = next.tasks.find(item => item.id === card.dataset.id);
    if (!task) return;
    task.status = ['todo', 'doing', 'done'].includes(event.target.value) ? event.target.value : 'todo';
    await commit(next, 'État de la tâche mis à jour.');
  });

  objectivesHost.addEventListener('change', async event => {
    const card = event.target.closest('[data-objective-card]');
    if (!card || !event.target.matches('select')) return;
    const next = clone(state);
    const goal = next.objectives.find(item => item.id === card.dataset.id);
    if (!goal) return;
    goal.status = ['active', 'paused', 'done'].includes(event.target.value) ? event.target.value : 'active';
    await commit(next, 'État de l’objectif mis à jour.');
  });

  section.addEventListener('click', async event => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    const card = button.closest('[data-id]');
    if (!card) return;
    const action = button.dataset.action;
    const labels = { 'delete-objective': 'Supprimer cet objectif ?', 'delete-task': 'Supprimer cette tâche ?', 'delete-report': 'Supprimer ce compte rendu ?' };
    if (!labels[action] || !confirm(labels[action])) return;
    const next = clone(state);
    if (action === 'delete-objective') {
      next.objectives = next.objectives.filter(item => item.id !== card.dataset.id);
      next.tasks.forEach(task => { if (task.objectiveId === card.dataset.id) task.objectiveId = ''; });
    } else if (action === 'delete-task') next.tasks = next.tasks.filter(item => item.id !== card.dataset.id);
    else if (action === 'delete-report') next.reports = next.reports.filter(item => item.id !== card.dataset.id);
    await commit(next, 'Élément supprimé de l’espace privé.');
  });

  tab.addEventListener('click', () => {
    if (!loaded && !loading) void loadWorkspace();
  });
  refreshButton.addEventListener('click', loadWorkspace);
  taskFilter.addEventListener('change', renderTasks);
  reportForm.elements.period.value = today();
})();
