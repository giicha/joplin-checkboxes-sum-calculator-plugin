import joplin from 'api';

joplin.plugins.register({
	onStart: async function() {
		const panels = joplin.views.panels;
		const view = await panels.create('checkbox_sum_panel');
		
		let isPanelVisible = true;

		await panels.setHtml(view, '<div><h3>Checked Sum:</h3><h1 style="color: #4fbc87; font-size: 28px;">0</h1></div>');
		await panels.show(view);

		// Функция для очистки текста от HTML-тегов
		function stripHtml(html: string): string {
			return html.replace(/<\/?[^>]+(>|\$)/g, "").trim();
		}

		async function updateSum() {
			const note = await joplin.workspace.selectedNote();
			if (!note || !note.body) {
				await panels.setHtml(view, '<div style="padding: 10px; font-family: sans-serif;"><h3>Checked Sum:</h3><h1 style="color: #4fbc87; font-size: 28px;">0</h1></div>');
				return;
			}

			let totalSum = 0;
			const text = note.body;
			const numberRegex = /\d+/g;
			
			// Массив для сохранения текста найденных строк для вывода в панель
			let detailsLines: string[] = [];

			// --- ЧАСТЬ 1: Разбор HTML-таблиц (Визуальный редактор) ---
			const trRegex = /<tr[^>]*>([\s\(\S\)]*?)<\/tr>/gi;
			let trMatch;

			while ((trMatch = trRegex.exec(text)) !== null) {
				const trContent = trMatch[1];
				
				// Проверяем, есть ли в этой строке отмеченный чекбокс
				if (/<li[^>]*class="[^"]*checked[^"]*"[^>]*>/i.test(trContent)) {
					
					// Разбираем строку на ячейки <td>
					const tdRegex = /<td[^>]*>([\s\(\S\)]*?)<\/td>/gi;
					let tdMatch;
					let rowTexts: string[] = [];

					while ((tdMatch = tdRegex.exec(trContent)) !== null) {
						const cleanText = stripHtml(tdMatch[1]);
						// Если ячейка не пустая, сохраняем её текст
						if (cleanText.length > 0) {
							rowTexts.push(cleanText);
						}
					}

					if (rowTexts.length > 0) {
						detailsLines.push(rowTexts.join(' → '));
					}

					// Считаем числа из этой строки
					const numbers = trContent.match(numberRegex);
					if (numbers) {
						for (const numStr of numbers) {
							totalSum += parseInt(numStr, 10);
						}
					}
				}
			}

			// --- ЧАСТЬ 2: Разбор обычного Markdown текста (Вне таблиц) ---
			const mdRegex = /^\s*-\s+\[[xX]\]([^\n\(\r\)]*)/gm;
			let mdMatch;
			while ((mdMatch = mdRegex.exec(text)) !== null) {
				const lineContent = mdMatch[1].trim();
				if (lineContent.length > 0) {
					detailsLines.push(lineContent);
				}
				
				const numbers = lineContent.match(numberRegex);
				if (numbers) {
					for (const numStr of numbers) {
						totalSum += parseInt(numStr, 10);
					}
				}
			}

			// Генерируем HTML-код для списка деталей
			let detailsHtml = '';
			if (detailsLines.length > 0) {
				detailsHtml = `<h4 style="margin-top: 20px; margin-bottom: 5px; color: #666; border-top: 1px solid #ddd; padding-top: 10px;">Details:</h4>`;
				detailsHtml += `<ul style="padding-left: 20px; margin: 0; font-size: 14px; color: #333; line-height: 1.4;">`;
				for (const line of detailsLines) {
					detailsHtml += `<li style="margin-bottom: 4px;">${line}</li>`;
				}
				detailsHtml += `</ul>`;
			}

			// Обновляем панель
			await panels.setHtml(view, `
				<div style="padding: 10px; font-family: sans-serif;">
					<h3 style="margin-bottom: 5px; color: #555;">Checked Sum:</h3>
					<h1 style="color: #2da44e; font-size: 36px; margin: 0;">${totalSum}</h1>
					${detailsHtml}
				</div>
			`);
		}

		// Команда скрытия/показа
		await joplin.commands.register({
			name: 'toggleCheckboxSumPanel',
			label: 'Toggle Checkbox Sum Panel',
			iconName: 'fas fa-plus-square', // ОБНОВЛЕНО: Новая иконка плюса
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

		await joplin.views.toolbarButtons.create(
			'toggleCheckboxSumPanelButton', 
			'toggleCheckboxSumPanel', 
			'noteToolbar' as any
		);

		await joplin.workspace.onNoteChange(() => {
			if (isPanelVisible) updateSum();
		});

		await joplin.workspace.onNoteSelectionChange(() => {
			if (isPanelVisible) updateSum();
		});

		updateSum();
	},
});
