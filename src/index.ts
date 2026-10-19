import joplin from 'api';

joplin.plugins.register({
	onStart: async function() {
		const panels = joplin.views.panels;
		const view = await panels.create('checkbox_sum_panel');
		
		// Variable to track panel visibility state (open by default)
		let isPanelVisible = true;

		// Set initial HTML template
		await panels.setHtml(view, '<div><h3>Checked Sum:</h3><h1 style="color: #4fbc87; font-size: 28px;">0</h1></div>');
		await panels.show(view);

		// Helper function to strip HTML tags from string content
		function stripHtml(html: string): string {
			return html.replace(/<\/?[^>]+(>|\$)/g, "").trim();
		}

		// Core function to calculate the sum and refresh the UI layout
		async function updateSum() {
			const note = await joplin.workspace.selectedNote();
			if (!note || !note.body) {
				await panels.setHtml(view, '<div style="padding: 10px; font-family: sans-serif;"><h3>Checked Sum:</h3><h1 style="color: #4fbc87; font-size: 28px;">0</h1></div>');
				return;
			}

			let totalSum = 0;
			const text = note.body;
			const numberRegex = /\d+/g;
			
			// Array to store extracted content for the Details block
			let detailsLines: string[] = [];

			// --- PART 1: Processing HTML Tables (Rich Text / WYSIWYG Editor) ---
			const trRegex = /<tr[^>]*>([\s\(\S\)]*?)<\/tr>/gi;
			let trMatch;

			while ((trMatch = trRegex.exec(text)) !== null) {
				const trInnerContent = trMatch[1];
				
				// Verify if the current row contains a checked list item
				if (/<li[^>]*class="[^"]*checked[^"]*"[^>]*>/i.test(trInnerContent)) {
					
					const tdRegex = /<td[^>]*>([\s\(\S\)]*?)<\/td>/gi;
					let tdMatch;
					let rowTexts: string[] = [];
					let rowSum = 0;

					while ((tdMatch = tdRegex.exec(trInnerContent)) !== null) {
						const cellHtml = tdMatch[1];
						const cleanText = stripHtml(cellHtml);
						
						if (cleanText.length > 0) {
							// Highlight numbers inside the text cell by wrapping them in <b> tags
							const boldedText = cleanText.replace(numberRegex, (num) => `<b>${num}</b>`);
							rowTexts.push(boldedText);
							
							const cellNumbers = cleanText.match(numberRegex);
							if (cellNumbers) {
								for (const numStr of cellNumbers) {
									rowSum += parseInt(numStr, 10);
								}
							}
						}
					}

					totalSum += rowSum;

					if (rowTexts.length > 0) {
						// Format: <b>RowSum</b> (Cell1 → Cell2)
						const rowDescription = rowTexts.join(' → ');
						detailsLines.push(`<b>${rowSum}</b> (${rowDescription})`);
					}
				}
			}

			// --- PART 2: Processing Standard Markdown Text (Outside Tables) ---
			const mdRegex = /^\s*-\s+\[[xX]\]([^\n\(\r\)]*)/gm;
			let mdMatch;
			while ((mdMatch = mdRegex.exec(text)) !== null) {
				const lineContent = mdMatch[1].trim();
				
				if (lineContent.length > 0) {
					let lineSum = 0;
					const numbers = lineContent.match(numberRegex);
					if (numbers) {
						for (const numStr of numbers) {
							lineSum += parseInt(numStr, 10);
						}
						totalSum += lineSum;
					}

					// Highlight numbers inside the markdown line text
					const boldedLineContent = lineContent.replace(numberRegex, (num) => `<b>${num}</b>`);

					// Format: <b>LineSum</b> (Line text content)
					detailsLines.push(`<b>${lineSum}</b> (${boldedLineContent})`);
				}
			}

			// Build HTML template dynamically for the detailed rows list
			let detailsHtml = '';
			if (detailsLines.length > 0) {
				detailsHtml = `<h4 style="margin-top: 20px; margin-bottom: 5px; color: #666; border-top: 1px solid #ddd; padding-top: 10px;">Details:</h4>`;
				detailsHtml += `<ul style="padding-left: 20px; margin: 0; font-size: 14px; color: #333; line-height: 1.4;">`;
				for (const line of detailsLines) {
					detailsHtml += `<li style="margin-bottom: 4px;">${line}</li>`;
				}
				detailsHtml += `</ul>`;
			}

			// Update the side view panel with computed dataset and the new notice message at the bottom
			await panels.setHtml(view, `
				<div style="padding: 10px; font-family: sans-serif;">
					<h3 style="margin-bottom: 5px; color: #555;">Checked Sum:</h3>
					<h1 style="color: #2da44e; font-size: 36px; margin: 0;"><b>${totalSum}</b></h1>
					${detailsHtml}
					<p style="font-size: 11px; color: #888; margin-top: 25px; border-top: 1px dashed #ccc; padding-top: 8px; line-height: 1.3;">
						<i>Notice: The plugin sums up all numbers found within a checked row, including those in item titles or serial models.</i>
					</p>
				</div>
			`);
		}

		// Command to handle toggling panel visibility
		await joplin.commands.register({
			name: 'toggleCheckboxSumPanel',
			label: 'Toggle Checkbox Sum Panel',
			iconName: 'fas fa-plus-square',
			execute: async () => {
				isPanelVisible = !isPanelVisible;
				if (isPanelVisible) {
					await panels.show(view);
					updateSum();
				} else {
					await panels.hide(view);
				}
			},
		});

		// Render the action trigger icon onto the main note toolbar
		await joplin.views.toolbarButtons.create(
			'toggleCheckboxSumPanelButton', 
			'toggleCheckboxSumPanel', 
			'noteToolbar' as any
		);

		// Event listeners
		await joplin.workspace.onNoteChange(() => {
			if (isPanelVisible) updateSum();
		});

		await joplin.workspace.onNoteSelectionChange(() => {
			if (isPanelVisible) updateSum();
		});

		updateSum();
	},
});
