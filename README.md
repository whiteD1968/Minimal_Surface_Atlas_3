# 260428_BatwingGyroid

260428_BatwingGyroid is a Vite + TypeScript + Three.js batwing mesh generator for building a welded, arrayed batwing surface in a live browser tool. The app starts from a fixed centered source cube, treats `G0` as the top square and `G1` as the bottom square, then rebuilds a welded batwing array from four vertex-position sliders. The current tool includes thickness, Catmull-Clark subdivision, lattice deformation, face-direction inspection, display toggles, and OBJ / GLB / PNG export while keeping the studio scene, reflective material style, grid, and floating panel workflow from the reference canopy project.

## Features
- Fixed-cube batwing generator based on a 4-vertex `G0` / `G1` curve workflow.
- Four live `Vert Positions` sliders, each clamped from `0.01` to `0.99`, defaulting to `0.50`.
- Base topology with 33 generated vertices, 24 quad regions, and 48 triangulated faces.
- Array controls repeat the batwing as a welded 3D grid with length, width, and upward height counts from `1` to `20`.
- Coincident vertices across touching batwings are welded into one unified mesh while preserving face directions.
- Thickness solidifies the welded array into a two-sided capped shell before smoothing.
- Quad-face Catmull-Clark subdivision smooths the unified mesh from `0` to `3` levels.
- Lattice controls create a selectable 3D point grid around the unified mesh for persistent deformation.
- Combined move, rotate, and scale transform gizmo works from a single selected lattice point or the average of multiple selected points.
- Lattice reset returns all deformation points to the current bounding-box grid.
- Display toggles control the base grid, bounding boxes, lattice controls, mesh wires, foil material, and back-face inspection.
- Back Faces mode overrides the material with white front faces and bright pink back faces for face-direction debugging.
- Studio lighting, reflection environment, foil material, and fading infinite grid are adapted from the reference project.
- OBJ, GLB, and screenshot export save the current welded, thickened, subdivided, and lattice-deformed batwing state.

## Getting Started
1. `npm install`
2. `npm run dev` to start the local Vite development server at `http://localhost:5173`
3. Adjust `Vert Positions 1`, `Vert Positions 2`, `Vert Positions 3`, and `Vert Positions 4` to regenerate the batwing mesh
4. Adjust `Length Count`, `Width Count`, and `Height Count` to array the batwing as a welded 3D grid
5. Increase `Thickness` to solidify the welded array before subdivision
6. Increase `Subdivisions` to smooth the joined quad mesh with Catmull-Clark subdivision
7. Adjust `Length Division`, `Width Division`, and `Height Division` to create lattice deformation points
8. Select lattice points and use the unified transform gizmo to deform the mesh
9. Use the display toggles to inspect the grid, bounding boxes, lattice controls, wires, material, and back faces
10. Export the current shape as OBJ, GLB, or screenshot when the mesh is ready

## Controls
- `Vert Positions 1` shifts edge and vertical points along source cube edges.
- `Vert Positions 2` shifts edge and face-detail points toward source cube corners and square-face centers.
- `Vert Positions 3` shifts alternating face-detail points toward the batwing center.
- `Vert Positions 4` shifts side-center points and internal face points toward the cube center.
- `Length Count` arrays the batwing along the Z axis.
- `Width Count` arrays the batwing along the X axis.
- `Height Count` arrays the batwing upward from the ground along the Y axis.
- `Thickness` offsets the welded surface into a capped shell before subdivision.
- `Subdivisions` applies quad-face Catmull-Clark smoothing to the welded array mesh.
- `Length Division`, `Width Division`, and `Height Division` set the lattice point grid density.
- `LMB` selects one lattice point.
- `Shift+LMB` adds to or toggles the current lattice point selection.
- `Ctrl+LMB` deselects one lattice point.
- `LMB+Drag` marquee-selects lattice points inside the selection box.
- `Ctrl+LMB+Drag` marquee-deselects lattice points inside the darker deselection box.
- The lattice transform gizmo moves, rotates, or scales selected points from their shared center.
- `Reset` in the Lattice section returns all lattice points to their current bounding-box positions.
- `Base Grid` toggles the viewport grid.
- `Bounding Boxes` toggles the source cube and array guide boxes.
- `Lattice Controls` toggles the lattice points, lattice lines, and transform gizmo.
- `Mesh Wires` toggles the wire overlay.
- `Foil Material` toggles between the reflective foil style and a matte material.
- `Back Faces` shows front faces as white and back faces as bright pink.
- `Ctrl+Z` undoes committed slider, array, lattice, and display changes.
- `Ctrl+Y` or `Ctrl+Shift+Z` redoes committed slider, array, lattice, and display changes.
- `Mouse Wheel` zooms, `MMB` pans, and `RMB` orbits.
- `Export OBJ`, `Export GLB`, and `Export Screenshot` save the current batwing state.

## Deployment
- **Local production preview:** `npm install`, then `npm run build -- --base ./` followed by `npm run preview` to inspect the compiled bundle with relative asset paths.
- **Publish to GitHub Pages:** From a clean `main`, run `npm run build -- --base ./`. In a separate temp folder or worktree, copy everything inside `dist/` to the root of the `gh-pages` branch, keep the flat Pages structure with `assets/`, `env/`, `index.html`, `favicon.svg`, `.gitignore`, and `.nojekyll`, commit with a descriptive message, `git push origin gh-pages`, then return to `main`.
- **Live demo:** https://ekimroyrp.github.io/260428_BatwingGyroid/
