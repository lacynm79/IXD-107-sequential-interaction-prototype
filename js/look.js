/* Soft 3D look: lays a light-to-shade gradient over every shape inside an element marked data-shade
   (light from the upper left), so the flat drawing reads as rounded, lit objects. Gradients are cheap
   to animate, unlike SVG lighting filters. Copies carry no col-* class, so the Colors tab still
   recolors the shapes underneath. "Soft 3D shading" in the Window tab hides all of it (.look3d). */
(() => {
  const SHAPES = 'rect, circle, ellipse, path, polygon';
  const round = n => n.tagName === 'circle' || n.tagName === 'ellipse';
  const filled = n => {
    const f = n.getAttribute('fill');
    return f !== 'none' && !(n.closest('[fill="none"]') && !f);
  };
  document.querySelectorAll('[data-shade]').forEach(host => {
    const list = host.matches(SHAPES) ? [host] : [...host.querySelectorAll(SHAPES)];
    list.forEach(n => {
      if (!filled(n) || n.closest('pattern, filter, clipPath, mask') || n.classList.contains('look3d')) return;
      const c = n.cloneNode(false);
      c.removeAttribute('id'); c.removeAttribute('class'); c.removeAttribute('style'); c.removeAttribute('data-shade');
      c.removeAttribute('stroke'); c.removeAttribute('stroke-width'); c.removeAttribute('opacity');
      c.setAttribute('fill', round(n) ? 'url(#shadeRound)' : 'url(#shade)');
      c.setAttribute('pointer-events', 'none');
      c.classList.add('look3d', 'shadeCopy');
      n.after(c);
    });
  });
})();
