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

		// Helper function to strip HTML tags and web spaces from string content
		function stripHtml(html: string): string {
			if (!html) return "";
			// Remove HTML tags, replace web spaces (&nbsp;), and trim edges
			return html
				.replace(/<\/?[^>]+(>|\$)/g, "")
				.replace(/&nbsp;/gi, "")
				.replace(/\s+/g, " ")
				.trim();
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
				const trInnerContent = trMatch[1]; // STRICT FIX: Extract index 1 string text group content
				
				// Verify if the current row contains a checked list item
				if (/<li[^>]*class="[^"]*checked[^"]*"[^>]*>/i.test(trInnerContent)) {
					
					const tdRegex = /<td[^>]*>([\s\(\S\)]*?)<\/td>/gi;
					let tdMatch;
					let rowTexts: string[] = [];
					let rowSum = 0;

					while ((tdMatch = tdRegex.exec(trInnerContent)) !== null) {
						const cellHtml = tdMatch[1]; // STRICT FIX: Extract index 1 string text group content
						const cleanRawText = stripHtml(cellHtml);
						
						if (cleanRawText.length > 0) {
							// Check if the cell text contains HTML bold markers, strong tags, or explicit inline bold CSS styles
							const isCellBold = /<b[^>]*>.*?<\/b>|<strong[^>]*>.*?<\/strong>|font-weight:\s*bold/gi.test(cellHtml);
							
							let formattedText = cleanRawText;
							if (isCellBold) {
								// It is an explicit bold model number: mark it yellow and skip calculation completely
								formattedText = cleanRawText.replace(numberRegex, (num) => `<mark style="background-color: #fff2a3; color: #5d4037; padding: 0 2px; border-radius: 2px;">${num}</mark>`);
							} else {
								// It is a regular number: mark it green and process the math
								formattedText = cleanRawText.replace(numberRegex, (num) => `<mark style="background-color: #d1f5d3; color: #1b5e20; padding: 0 2px; border-radius: 2px; font-weight: bold;">${num}</mark>`);
								
								const cellNumbers = cleanRawText.match(numberRegex);
								if (cellNumbers) {
									for (const numStr of cellNumbers) {
										rowSum += parseInt(numStr, 10);
									}
								}
							}
							rowTexts.push(formattedText);
						}
					}

					totalSum += rowSum;

					if (rowTexts.length > 0) {
						const rowDescription = rowTexts.join(' → ');
						detailsLines.push(`<b>${rowSum}</b> (${rowDescription})`);
					}
				}
			}

			// --- PART 2: Processing Standard Markdown Text (Outside Tables) ---
			const mdRegex = /^\s*-\s+\[[xX]\]([^\n\(\r\)]*)/gm;
			let mdMatch;
			while ((mdMatch = mdRegex.exec(text)) !== null) {
				const lineContent = mdMatch[1].trim(); // STRICT FIX: Extract index 1 string text group content
				
				if (lineContent.length > 0) {
					let lineSum = 0;
					
					// Convert Markdown bold tags into uniform yellow marks safely
					let processedMd = lineContent
						.replace(/\*\*(\d+)\*\*/g, (m, num) => `<mark style="background-color: #fff2a3; color: #5d4037; padding: 0 2px; border-radius: 2px;">${num}</mark>`)
						.replace(/__(\d+)__/g, (m, num) => `<mark style="background-color: #fff2a3; color: #5d4037; padding: 0 2px; border-radius: 2px;">${num}</mark>`);

					// Segment analysis for standard lines
					const parts = processedMd.split(/(<mark[^>]*>.*?<\/mark>)/g);
					let lineFormattedParts: string[] = [];
					
					for (const part of parts) {
						if (part.startsWith('<mark')) {
							lineFormattedParts.push(part); // Already highlighted yellow, skip math
						} else {
							// Count regular numbers and wrap them in a green marker
							const regularNumbers = part.match(numberRegex);
							if (regularNumbers) {
								for (const numStr of regularNumbers) {
									lineSum += parseInt(numStr, 10);
								}
							}
							const greenMarked = part.replace(numberRegex, (num) => `<mark style="background-color: #d1f5d3; color: #1b5e20; padding: 0 2px; border-radius: 2px; font-weight: bold;">${num}</mark>`);
							lineFormattedParts.push(greenMarked);
						}
					}

					totalSum += lineSum;
					const finalLineContent = lineFormattedParts.join('');
					detailsLines.push(`<b>${lineSum}</b> (${finalLineContent})`);
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

			// Update the side view panel with computed dataset and color-coded legend notice
			await panels.setHtml(view, `
				<div style="padding: 10px; font-family: sans-serif;">
					<h3 style="margin-bottom: 5px; color: #555;">Checked Sum:</h3>
					<h1 style="color: #2da44e; font-size: 36px; margin: 0;"><b>${totalSum}</b></h1>
					${detailsHtml}
					<p style="font-size: 11px; color: #888; margin-top: 25px; border-top: 1px dashed #ccc; padding-top: 8px; line-height: 1.4;">
						<i>Notice: All numbers in the row are added up (e.g., model IDs or serial numbers), except those formatted in bold. Counted numbers are highlighted in <span style="color: #1b5e20; font-weight: bold;">green</span>. Ignored numbers are highlighted in <span style="color: #b18a00; font-weight: bold;">yellow</span>.</i>
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
