function renderProgression() {
  const list = document.getElementById('milestone-list');
  const empty = document.getElementById('progress-empty');
  const overview = document.querySelector('.progress-overview');
  const overallLabel = document.getElementById('progress-overall');
  const overallBar = document.getElementById('progress-bar');
  const overallFill = document.getElementById('progress-fill');
  if (!list || !empty || !overview || !overallLabel || !overallBar || !overallFill) return;

  list.replaceChildren();
  const clamp = value => Math.min(100, Math.max(0, Number(value) || 0));
  let groups = [];
  try {
    const saved = JSON.parse(localStorage.getItem('rv-progressions') || 'null');
    if (Array.isArray(saved) && (!saved.length || Array.isArray(saved[0]?.steps))) groups = saved;
    else {
      const legacy = JSON.parse(localStorage.getItem('rv-milestones') || '[]');
      if (Array.isArray(legacy) && legacy.length) groups = [{ title: 'Progression principale', description: '', steps: legacy }];
    }
  } catch (error) {
    console.warn('Impossible de charger les progressions enregistrées.', error);
  }

  groups = groups
    .filter(group => group && group.title && group.published !== false)
    .map(group => ({
      ...group,
      steps: (Array.isArray(group.steps) ? group.steps : [])
        .filter(step => step && step.title && step.published !== false)
    }));

  const allSteps = groups.flatMap(group => group.steps);
  const overall = allSteps.length
    ? Math.round(allSteps.reduce((sum, step) => sum + clamp(step.progress), 0) / allSteps.length)
    : 0;
  overallLabel.textContent = `${overall} %`;
  overallBar.setAttribute('aria-valuenow', String(overall));
  requestAnimationFrame(() => {
    overallFill.style.width = `${overall}%`;
    overview.classList.add('is-visible');
  });

  if (!groups.some(group => group.steps.length)) {
    empty.hidden = false;
    return;
  }
  empty.hidden = true;

  groups.forEach((group, groupIndex) => {
    if (!group.steps.length) return;
    const section = document.createElement('section');
    section.className = 'progression-public reveal';
    section.style.setProperty('--step', String(groupIndex % 8));

    const header = document.createElement('header');
    header.className = 'progression-public-heading';
    const title = document.createElement('h2');
    title.textContent = group.title;
    header.append(title);
    if (group.description) {
      const intro = document.createElement('p');
      intro.textContent = group.description;
      header.append(intro);
    }

    const groupProgress = Math.round(
      group.steps.reduce((sum, step) => sum + clamp(step.progress), 0) / group.steps.length
    );
    const summary = document.createElement('div');
    summary.className = 'progression-global';
    const summaryLabel = document.createElement('div');
    summaryLabel.className = 'progress-overview-label';
    const summaryName = document.createElement('span');
    summaryName.textContent = 'PROGRESSION GLOBALE';
    const summaryValue = document.createElement('strong');
    summaryValue.textContent = `${groupProgress} %`;
    summaryLabel.append(summaryName, summaryValue);
    const summaryBar = document.createElement('div');
    summaryBar.className = 'progress-bar progression-global-bar';
    summaryBar.setAttribute('role', 'progressbar');
    summaryBar.setAttribute('aria-label', `Progression globale : ${group.title}`);
    summaryBar.setAttribute('aria-valuemin', '0');
    summaryBar.setAttribute('aria-valuemax', '100');
    summaryBar.setAttribute('aria-valuenow', String(groupProgress));
    const summaryFill = document.createElement('span');
    summaryFill.style.width = `${groupProgress}%`;
    summaryBar.append(summaryFill);
    summary.append(summaryLabel, summaryBar);

    const timeline = document.createElement('div');
    timeline.className = 'milestone-list';
    group.steps.forEach((item, index) => {
      const progress = clamp(item.progress);
      const article = document.createElement('article');
      article.className = 'milestone-card';
      article.style.setProperty('--step', String(index % 8));

      const point = document.createElement('span');
      point.className = 'milestone-point';
      point.textContent = String(index + 1).padStart(2, '0');
      const content = document.createElement('div');
      content.className = 'milestone-content';
      const heading = document.createElement('div');
      heading.className = 'milestone-title-row';
      const stepTitle = document.createElement('h3');
      stepTitle.textContent = item.title;
      const percent = document.createElement('strong');
      percent.className = 'milestone-percent';
      percent.textContent = `${progress} %`;
      heading.append(stepTitle, percent);

      const description = document.createElement('p');
      description.textContent = item.text || '';
      const bar = document.createElement('div');
      bar.className = 'progress-bar milestone-bar';
      bar.setAttribute('role', 'progressbar');
      bar.setAttribute('aria-label', `Avancement : ${item.title}`);
      bar.setAttribute('aria-valuemin', '0');
      bar.setAttribute('aria-valuemax', '100');
      bar.setAttribute('aria-valuenow', String(progress));
      const fill = document.createElement('span');
      fill.style.width = `${progress}%`;
      bar.append(fill);

      const footer = document.createElement('div');
      footer.className = 'milestone-meta';
      const status = document.createElement('span');
      status.textContent = item.status || 'En cours';
      footer.append(status);
      if (item.date) {
        const date = document.createElement('time');
        date.textContent = item.date;
        footer.append(date);
      }
      content.append(heading, description, bar, footer);
      article.append(point, content);
      timeline.append(article);
    });

    section.append(header, summary, timeline);
    list.append(section);
  });

  requestAnimationFrame(() => {
    document.querySelectorAll('.progression-public.reveal').forEach(element => element.classList.add('is-visible'));
  });
}

// Render local data immediately, then refresh from the shared Supabase content.
renderProgression();
window.RVCloud.ready.then(renderProgression);
