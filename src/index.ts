import joplin from 'api';

joplin.plugins.register({
	onStart: async function() {
		const panels = joplin.views.panels;
		const view = await panels.create('checkbox_sum_panel');
		
		// Variable to track panel visibility state (open by default)
		let isPanelVisible = true;

		// Set initial HTML template layout structure
		await panels.setHtml(view, '<div style="padding: 10px; font-family: sans-serif;"><h3>Checked Sum:</h3><h1 style="color: #2da44e; font-size: 36px; margin: 0;"><b>0</b></h1></div>');
		await panels.show(view);

		// Helper function to strip HTML tags and web spaces from string content safely
		function stripHtml(html: string): string {
			if (!html) {
				return "";
			}
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
				await panels.setHtml(view, '<div style="padding: 10px; font-family: sans-serif;"><h3>Checked Sum:</h3><h1 style="color: #2da44e; font-size: 36px; margin: 0;"><b>0</b></h1></div>');
				return;
			}

			let totalCheckedSum: number = 0;
			let totalUncheckedSum: number = 0;
			const numberRegex: RegExp = /\d+(?:[\.,]\d+)?/g;
			
			// Array to store dynamically generated HTML string snippets for the Details layout block
			let detailsLines: string[] = [];
			const noteBody: string = note.body;
			
			// Infrastructure array targets matching objects via strict type configurations
			const rowMatches: { index: number; type: 'html' | 'md'; content: RegExpExecArray }[] = [];
			
			// --- STEP 1: Scan and register HTML table rows ---
			const trRegex: RegExp = /<tr[^>]*>([\s\(\S\)]*?)<\/tr>/gi;
			let trMatch: RegExpExecArray | null;

			while ((trMatch = trRegex.exec(noteBody)) !== null) {
				rowMatches.push({
					index: trMatch.index,
					type: 'html',
					content: trMatch
				});
			}

			// --- STEP 2: Scan and register standard Markdown checklist elements ---
			const mdRegex: RegExp = /^\s*-\s+\[([ xX])\]([^\n\r]*)/gm;
			let mdMatch: RegExpExecArray | null;

			while ((mdMatch = mdRegex.exec(noteBody)) !== null) {
				rowMatches.push({
					index: mdMatch.index,
					type: 'md',
					content: mdMatch
				});
			}

			// --- STEP 3: Sort all items chronologically based on their exact text position index ---
			rowMatches.sort((a, b) => a.index - b.index);

			// --- STEP 4: Process sequentially downstream ---
			for (const item of rowMatches) {
				if (item.type === 'html') {
					// --- HTML TABLE ROW PARSING PROTOCOL ---
					const rowHtmlString: string = item.content[0];
					
					const tdRegex: RegExp = /<td[^>]*>([\s\(\S\)]*?)<\/td>/gi;
					let tdMatch: RegExpExecArray | null;
					
					// 1. Собрать содержимое всех ячеек в массив для анализа
					const tdContentMatches: string[] = [];
					while ((tdMatch = tdRegex.exec(rowHtmlString)) !== null) {
						tdContentMatches.push(tdMatch[0]);
					}
					tdRegex.lastIndex = 0; // Сброс индекс

					// Подсчитываем РЕАЛЬНЫЕ чекбоксы в строке таблицы
					let checkboxCount = 0;
					let isSingleCheckedRow = false; 

					for (const cellHtmlText of tdContentMatches) {
						// Чекбокс детектируется, если ячейка содержит класс joplin-checklist или теги списка чекбоксов
						const hasRealCheckbox = /class="[^"]*(?:checked|checkbox|joplin-checklist)[^"]*"/i.test(cellHtmlText) || /<li[^>]*>/i.test(cellHtmlText);
						if (hasRealCheckbox) {
							checkboxCount++;
							if (/class="[^"]*checked[^"]*"/i.test(cellHtmlText)) {
								isSingleCheckedRow = true;
							}
						}
					}

					if (checkboxCount > 0) {
						let rowTexts: string[] = [];
						let rowSumChecked: number = 0;
						let rowSumUnchecked: number = 0;
						let hasCheckedContent = false;

						// 2. Основной проход и разбор ячеек по условию количества чекбоксов
						while ((tdMatch = tdRegex.exec(rowHtmlString)) !== null) {
							const cellHtml: string = tdMatch[0];
							const cleanRawText: string = stripHtml(cellHtml);
							
							if (cleanRawText.length > 0) {
								const isCellChecked = /class="[^"]*checked[^"]*"/i.test(cellHtml);
								const isCellBold: boolean = /<b[^>]*>.*?<\/b>|<strong[^>]*>.*?<\/strong>|font-weight:\s*bold/gi.test(cellHtml);
								let formattedText: string = cleanRawText;
								
								if (isCellBold) {
									// Игнорируем жирные числа
									formattedText = cleanRawText.replace(numberRegex, (num: string) => `<mark style="background-color: #fff2a3; color: #5d4037; padding: 0 2px; border-radius: 2px;">${num}</mark>`);
								} else {
									const cellNumbers: RegExpMatchArray | null = cleanRawText.match(numberRegex);
									
									// Применяем гибридное правило
									if (checkboxCount <= 1) {
										// СЦЕНАРИЙ А: Чекбокс всего один на строку. Статус строки определяет судьбу всех чисел ряда.
										if (isSingleCheckedRow) {
											hasCheckedContent = true;
											formattedText = cleanRawText.replace(numberRegex, (num: string) => `<mark style="background-color: #d1f5d3; color: #1b5e20; padding: 0 2px; border-radius: 2px; font-weight: bold;">${num}</mark>`);
											if (cellNumbers) {
												for (const numStr of cellNumbers) {
													rowSumChecked += parseFloat(numStr.replace(',', '.'));
												}
											}
										} else {
											formattedText = cleanRawText.replace(numberRegex, (num: string) => `<mark style="background-color: #f0f0f0; color: #666; padding: 0 2px; border-radius: 2px;">${num}</mark>`);
											if (cellNumbers) {
												for (const numStr of cellNumbers) {
													rowSumUnchecked += parseFloat(numStr.replace(',', '.'));
												}
											}
										}
									} else {
										// СЦЕНАРИЙ Б: В строке НЕСКОЛЬКО чекбоксов. Считаем строго поклеточно.
										if (isCellChecked) {
											hasCheckedContent = true;
											formattedText = cleanRawText.replace(numberRegex, (num: string) => `<mark style="background-color: #d1f5d3; color: #1b5e20; padding: 0 2px; border-radius: 2px; font-weight: bold;">${num}</mark>`);
											if (cellNumbers) {
												for (const numStr of cellNumbers) {
													rowSumChecked += parseFloat(numStr.replace(',', '.'));
												}
											}
										} else {
											formattedText = cleanRawText.replace(numberRegex, (num: string) => `<mark style="background-color: #f0f0f0; color: #666; padding: 0 2px; border-radius: 2px;">${num}</mark>`);
											if (cellNumbers) {
												for (const numStr of cellNumbers) {
													rowSumUnchecked += parseFloat(numStr.replace(',', '.'));
												}
											}
										}
									}
								}
								rowTexts.push(formattedText);
							}
						}

						// Накапливаем глобальную аналитику раздельно
						totalCheckedSum += rowSumChecked;
						totalUncheckedSum += rowSumUnchecked;

						// В список Details выводим сумму выполненного в этой строке
						if (hasCheckedContent && rowSumChecked > 0) {
							const displayRowSum = Number(rowSumChecked.toFixed(2));
							detailsLines.push(`<b>${displayRowSum}</b> (${rowTexts.join(' - ')})`);
						}
					}
				} else {
					// --- STANDARD MARKDOWN LINE PARSING PROTOCOL ---
					const statusChar: string = item.content[1];
					const isChecked: boolean = (statusChar.trim().toLowerCase() === 'x');
					const lineContent: string = item.content[2];
					
					if (lineContent && lineContent.trim().length > 0) {
						let lineSum: number = 0;
						const cleanLine: string = lineContent.trim();
						
						let processedMd: string = cleanLine
							.replace(/\*\*([\s\(\S\)]*?)\*\*/g, (m, boldText) => {
								const shieldedText = boldText.replace(numberRegex, (num: string) => `<mark class="sum-ignored" style="background-color: #fff2a3; color: #5d4037; padding: 0 2px; border-radius: 2px; font-weight: bold;">${num}</mark>`);
								return `<b>${shieldedText}</b>`;
							})
							.replace(/__([\s\(\S\)]*?)__/g, (m, boldText) => {
								const shieldedText = boldText.replace(numberRegex, (num: string) => `<mark class="sum-ignored" style="background-color: #fff2a3; color: #5d4037; padding: 0 2px; border-radius: 2px; font-weight: bold;">${num}</mark>`);
								return `<b>${shieldedText}</b>`;
							});

						let tempTextForMath = processedMd;
						tempTextForMath = tempTextForMath.replace(/<mark class=["']sum-ignored["'][^>]*>.*?<\/mark>/gi, '');
						
						const regularNumbers: RegExpMatchArray | null = tempTextForMath.match(numberRegex);
						if (regularNumbers) {
							for (const numStr of regularNumbers) {
								const parsedVal = parseFloat(numStr.replace(',', '.'));
								if (!isNaN(parsedVal)) {
									lineSum += parsedVal;
								}
							}
						}

						const parts = processedMd.split(/(<mark[^>]*>.*?<\/mark>|<b>.*?<\/b>)/g);
						let lineFormattedParts: string[] = [];

						for (const part of parts) {
							if (part.startsWith('<mark') || part.startsWith('<b>')) {
								lineFormattedParts.push(part);
							} else {
								let markedPart = part;
								if (isChecked) {
									markedPart = part.replace(numberRegex, (num: string) => `<mark style="background-color: #d1f5d3; color: #1b5e20; padding: 0 2px; border-radius: 2px; font-weight: bold;">${num}</mark>`);
								} else {
									markedPart = part.replace(numberRegex, (num: string) => `<mark style="background-color: #f0f0f0; color: #666; padding: 0 2px; border-radius: 2px;">${num}</mark>`);
								}
								lineFormattedParts.push(markedPart);
							}
						}

						let finalLineContent: string = lineFormattedParts.join('');
						finalLineContent = finalLineContent.replace(/<\/?b[^>]*>/gi, '');

						const displayLineSum: number = Number(lineSum.toFixed(2));
						
						if (isChecked) {
							totalCheckedSum += Number(lineSum);
							detailsLines.push(`<b>${displayLineSum}</b> (${finalLineContent})`);
						} else {
							totalUncheckedSum += Number(lineSum);
						}
					}
				}
			}
			// --- STEP 5: Build HTML nodes dynamically for the Details collection ---
			let detailsHtml: string = '';
			if (detailsLines.length > 0) {
				detailsHtml = `<h4 style="margin-top: 20px; margin-bottom: 5px; color: #666; border-top: 1px solid #ddd; padding-top: 10px;">Details:</h4>`;
				detailsHtml += `<ul style="padding-left: 20px; margin: 0; font-size: 14px; color: #333; line-height: 1.4;">`;
				for (const line of detailsLines) {
					detailsHtml += `<li style="margin-bottom: 4px;">${line}</li>`;
				}
				detailsHtml += `</ul>`;
			}

			const displayCheckedSum: number = Number(totalCheckedSum.toFixed(2));
			const displayUncheckedSum: number = Number(totalUncheckedSum.toFixed(2));
			const displayGrandTotalSum: number = Number((totalCheckedSum + totalUncheckedSum).toFixed(2));

			// --- STEP 6: Render Analytics Summary ---
			const analyticsHtml: string = `
				<div style="margin-top: 15px; padding-top: 10px; border-top: 1px dashed #bbb; font-size: 13px; color: #444; line-height: 1.6;">
					<div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
						<span>Сhecked:</span>
						<span style="color: #2da44e; font-weight: bold;">${displayCheckedSum}</span>
					</div>
					<div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
						<span>Unchecked (Remaining):</span>
						<span style="color: #c93b3b; font-weight: bold;">${displayUncheckedSum}</span>
					</div>
					<div style="display: flex; justify-content: space-between; color: #000; margin-top: 4px; padding: 2px 0;">
						<span>Total:</span>
						<span>${displayGrandTotalSum}</span>
					</div>
				</div>
			`;

			// --- STEP 7: Flush layout changes straight into the Joplin side UI view pane ---
			await panels.setHtml(view, `
				<div style="padding: 10px; font-family: sans-serif; box-sizing: border-box; height: 100vh; overflow-y: auto;">
					<h3 style="margin-bottom: 5px; color: #555;">Checked Sum:</h3>
					<h1 style="color: #2da44e; font-size: 36px; margin: 0;"><b>${displayCheckedSum}</b></h1>
					${detailsHtml}
					${analyticsHtml}
					<p style="font-size: 11px; color: #888; margin-top: 20px; border-top: 1px dashed #ccc; padding-top: 8px; line-height: 1.4; padding-bottom: 20px;">
						<i>Notice: All numbers in the row are added up (e.g., model IDs or serial numbers), except those formatted in <b>bold</b>. Counted numbers are highlighted in <span style="background-color: #d1f5d3; color: #1b5e20; padding: 0 2px; border-radius: 2px; font-weight: bold;">green</span>. Ignored numbers are highlighted in <span style="background-color: #fff2a3; color: #5d4037; padding: 0 2px; border-radius: 2px; font-weight: bold;">yellow</span>.</i>
					</p>
				</div>
			`);
		}

		// Configure action command to intercept toolbar visibility requests
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

		// Attach command handle onto the primary visual interface node
		await joplin.views.toolbarButtons.create(
			'toggleCheckboxSumPanelButton', 
			'toggleCheckboxSumPanel', 
			'noteToolbar' as any
		);

		// Workspace Event Listeners
		await joplin.workspace.onNoteChange(() => {
			if (isPanelVisible) {
				updateSum();
			}
		});

		await joplin.workspace.onNoteSelectionChange(() => {
			if (isPanelVisible) {
				updateSum();
			}
		});

		// Initial application bootstrap calculation execution
		updateSum();
	},
});
