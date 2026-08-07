 const scriptURL = 'https://script.google.com/macros/s/AKfycbwDWxdFBq4WeKLBUZCXA5Ores39RPk4Miz0RXMy7SuvqNmxZMq-yv3-IhqcuPy8qFVG/exec';
        
        let alleProgrammerGlobal = [];
        let aktuelleProgrammerVist = []; 
        let aktuelDato = new Date();
        let valgtAar = aktuelDato.getFullYear();
        let valgtMaaned = aktuelDato.getMonth();
        let visKunIdag = false;
        
        let brugerRolle = ""; 
        let aktuelBruger = "";
        let aktueltNavn = ""; 
        let aktuelPassLen = 8; 
        let aktuelNotifikation = false; 
        
        let formInitialState = ""; 
        let techFormInitialState = ""; 
        
        let kopieretTechOpsaetning = null;
        let pendingTechInfoForNewProgram = null;

        function hentFormularState() {
            const data = {};
            const fieldsToCheck = ['Dato', 'Tid', 'TX', 'Kanal', 'Premieredato', 'Sportsgren', 'Programtitel', 'Lokation', 'Unit', 'Format', 'RX', 'P-plan', 'Noter', 'Producer', 'Kommentator', 'Ekspert', 'Reporter'];
            
            for (let id of fieldsToCheck) {
                const el = document.getElementById(id);
                if (el) data[id] = el.value.trim();
            }
            
            const checkboxes = Array.from(document.querySelectorAll('#signalDropdown input[type="checkbox"]:checked')).map(cb => cb.value).sort();
            data['Signal'] = checkboxes.join(',');
            
            const tbcBox = document.getElementById('TBC');
            data['TBC'] = tbcBox && tbcBox.checked;
            
            return JSON.stringify(data);
        }

        function truncateText(text, maxLength) {
            if (!text) return '';
            if (text.length > maxLength) {
                return text.substring(0, maxLength - 3) + '...';
            }
            return text;
        }

        async function genererPDF() { 
            if (valgtMaaned === -1 || !valgtAar) return;

            const pdfBtn = document.getElementById('btnExportPDF');
            const orgTekst = pdfBtn.innerHTML;
            pdfBtn.innerHTML = '⏳';
            pdfBtn.disabled = true;

            const maanedNavne = ["januar", "februar", "marts", "april", "maj", "juni", "juli", "august", "september", "oktober", "november", "december"];
            const maanedNavn = maanedNavne[valgtMaaned];
            const overskrift = `Produktioner, ${maanedNavn} ${valgtAar}`;

            let logoData = null;
            try {
                const imgEl = document.querySelector('.title-wrapper img');
                const canvas = document.createElement('canvas');
                canvas.width = imgEl.naturalWidth || imgEl.width || 200;
                canvas.height = imgEl.naturalHeight || imgEl.height || 50;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(imgEl, 0, 0);
                logoData = canvas.toDataURL('image/png');
            } catch(e) { console.log('Kunne ikke hente logo', e); }

            const tableBody = [];
            tableBody.push([
                { text: 'Dato', bold: true, fontSize: 10, fillColor: '#e9ecef', border: [false, true, false, true] },
                { text: 'Sportsgren', bold: true, fontSize: 10, fillColor: '#e9ecef', border: [false, true, false, true] },
                { text: 'Produktion', bold: true, fontSize: 10, fillColor: '#e9ecef', border: [false, true, false, true] },
                { text: 'Sted', bold: true, fontSize: 10, fillColor: '#e9ecef', border: [false, true, false, true] },
                { text: 'Tid', bold: true, fontSize: 10, fillColor: '#e9ecef', border: [false, true, false, true] }, 
                { text: 'Kommentator/vært', bold: true, fontSize: 10, fillColor: '#e9ecef', border: [false, true, false, true] },
                { text: 'Ekspert/gæst', bold: true, fontSize: 10, fillColor: '#e9ecef', border: [false, true, false, true] }
            ]);

            const searchTerm = document.getElementById('searchInput').value.toLowerCase().trim();

            let programmerTilPDF = alleProgrammerGlobal.filter(p => {
                const kanalNavn = String(p["Kanal"] || '');
                if (kanalNavn !== 'SPORT LIVE' && kanalNavn !== 'Optagelse') return false;

                let pdfDato = p["NormDato"] || "";
                if (kanalNavn === 'Optagelse' && p["Premieredato"]) {
                    pdfDato = p["Premieredato"];
                }
                
                if (!pdfDato) return false;

                const parts = String(pdfDato).split('-');
                if (parts.length !== 3) return false;
                const pAar = parseInt(parts[0], 10);
                const pMaaned = parseInt(parts[1], 10) - 1;

                if (pAar !== valgtAar || pMaaned !== valgtMaaned) return false;

                if (searchTerm !== '') {
                    const alleFelterTekst = Object.values(p).map(v => String(v)).join(' ').toLowerCase();
                    if (!alleFelterTekst.includes(searchTerm)) { return false; }
                }

                return true;
            });

            programmerTilPDF.sort((a, b) => {
                const datoA = (String(a["Kanal"]) === 'Optagelse' && a["Premieredato"]) ? String(a["Premieredato"]) : String(a["NormDato"] || "");
                const datoB = (String(b["Kanal"]) === 'Optagelse' && b["Premieredato"]) ? String(b["Premieredato"]) : String(b["NormDato"] || "");
                if (datoA !== datoB) return datoA.localeCompare(datoB);
                const tidA = String(a["Tid"] || "23:59");
                const tidB = String(b["Tid"] || "23:59");
                return tidA.localeCompare(tidB);
            });

            programmerTilPDF.forEach(p => {
                let rawDato = p["NormDato"];
                if (String(p["Kanal"]) === 'Optagelse' && p["Premieredato"]) {
                    rawDato = p["Premieredato"];
                }
                let datoStr = "";
                if (rawDato) {
                    const parts = String(rawDato).split('-');
                    if(parts.length === 3) datoStr = parts[2] + "." + parts[1] + "." + parts[0].substring(2,4);
                }

                let pTid = String(p["Tid"] || '-');
                let pTX = String(p["TX"] || '-');
                
                if (String(p["Kanal"]) === 'Optagelse') {
                    pTid = '-';
                    pTX = '-';
                } else {
                    if (pTid !== '-' && pTid.includes('T')) pTid = new Date(pTid).toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' });
                    else if (pTid !== '-') pTid = pTid.substring(0, 5);

                    if (pTX !== '-' && pTX.includes('T')) pTX = new Date(pTX).toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' });
                    else if (pTX !== '-') pTX = pTX.substring(0, 5);
                }

                let pSted = p["Lokation"] && String(p["Lokation"]).trim() !== '' ? String(p["Lokation"]).trim() : 'TBA';
                let truncSted = truncateText(pSted, 30);

                let rawProduktion = p["Programtitel"] ? String(p["Programtitel"]).trim() : '';
                let hasTBC = p["TBC"] && String(p["TBC"]).toUpperCase() === 'X';
                
                let prodLimit = hasTBC ? 50 : 55;
                let truncProduktion = truncateText(rawProduktion, prodLimit);

                let produktionCelle = { text: truncProduktion, noWrap: true }; 
                if (hasTBC) {
                    produktionCelle = {
                        text: [
                            { text: truncProduktion },
                            { text: ' TBC', color: 'red', bold: true }
                        ],
                        noWrap: true
                    };
                }

                let kommTxt = String(p["Kommentator"] || '');
                if (String(p["Kanal"]) === 'Optagelse' && String(p["Unit"]) === 'EFP') {
                    if (kommTxt.trim() === '' && p["Reporter"] && String(p["Reporter"]).trim() !== '') {
                        kommTxt = String(p["Reporter"]).trim();
                    }
                }

                tableBody.push([
                    { text: datoStr, fontSize: 9 },
                    { text: String(p["Sportsgren"] || ''), fontSize: 9 },
                    { ...produktionCelle, fontSize: 9 },
                    { text: truncSted, fontSize: 9, noWrap: true },
                    { text: pTX, fontSize: 9, bold: true }, 
                    { text: kommTxt, fontSize: 9 },
                    { text: String(p["Ekspert"] || ''), fontSize: 9 }
                ]);
            });

            const docDefinition = {
                pageOrientation: 'landscape',
                pageMargins: [40, 115, 40, 30], 
                defaultStyle: { color: '#000000' },
                header: function() {
                    return {
                        margin: [32, 20, 40, 0],
                        columns: [
                            {
                                stack: [
                                    logoData ? { image: logoData, width: 270 } : { text: 'SPORT LIVE', fontSize: 36, bold: true, color: '#dc5e11' },
                                    { text: overskrift, fontSize: 19, bold: true, margin: [10, 6, 0, 0], color: '#000000' } 
                                ],
                                width: '*'
                            },
                            {
                                stack: [
                                    { text: 'Tid indikerer start på programmet eller transmissionen inkl. optakt.', italics: true, fontSize: 10, alignment: 'right', color: '#000000' },
                                    { text: 'Se detaljeret programoversigt på sport-live.dk/programoversigt.', italics: true, fontSize: 10, alignment: 'right', color: '#000000', margin: [0, 6, 0, 0] }
                                ],
                                width: 'auto',
                                margin: [0, 42, 10, 0] 
                            }
                        ]
                    };
                },
                content: [
                    {
                        table: {
                            headerRows: 1,
                            widths: [50, 65, '*', 140, 35, 95, 95],
                            body: tableBody
                        },
                        layout: {
                            fillColor: function (rowIndex) { return (rowIndex > 0 && rowIndex % 2 === 0) ? '#f8f9fa' : null; },
                            hLineWidth: function (i, node) { return (i === 0 || i === node.table.body.length) ? 0 : 0.5; },
                            vLineWidth: function (i, node) { return 0; },
                            hLineColor: function (i, node) { return '#e1e4e8'; },
                            paddingTop: function(i, node) { return 6; },
                            paddingBottom: function(i, node) { return 6; }
                        }
                    }
                ]
            };

            try {
                pdfMake.createPdf(docDefinition).download(`SPORT LIVE (${maanedNavn} ${valgtAar}).pdf`);
            } catch(e) {
                alert('Der skete en fejl ved generering af PDF.');
                console.error(e);
            }

            pdfBtn.innerHTML = orgTekst;
            pdfBtn.disabled = false;
        }

        async function logInd() {
            const user = document.getElementById('loginUsername').value.trim();
            const pass = document.getElementById('loginPassword').value;
            const errorDiv = document.getElementById('loginError');
            const btn = document.getElementById('btnLogin');
            const loader = document.getElementById('loginLoader');

            if (!user || !pass) {
                errorDiv.textContent = "Udfyld venligst begge felter";
                errorDiv.style.display = "block";
                return;
            }

            errorDiv.style.display = "none";
            btn.style.display = "none";
            loader.style.display = "block";

            try {
                const response = await fetch(scriptURL, {
                    method: 'POST',
                    body: JSON.stringify({ action: "login", username: user, password: pass }),
                    headers: { 'Content-Type': 'text/plain;charset=utf-8' }
                });
                
                const result = await response.json();
                
                if (result.success) {
                    brugerRolle = result.rolle || "Læser";
                    aktuelBruger = user;
                    aktueltNavn = result.navn || user; 
                    aktuelPassLen = result.passLength || 8; 
                    aktuelNotifikation = (result.notifikation === "X"); 
                    
                    localStorage.setItem('sportlive_user', aktuelBruger);
                    localStorage.setItem('sportlive_role', brugerRolle);
                    localStorage.setItem('sportlive_navn', aktueltNavn);
                    localStorage.setItem('sportlive_passlen', aktuelPassLen); 
                    localStorage.setItem('sportlive_notif', aktuelNotifikation ? "true" : "false"); 
                    
                    afslutLogin();
                } else {
                    errorDiv.textContent = result.message || "Forkert brugernavn eller adgangskode";
                    errorDiv.style.display = "block";
                    btn.style.display = "block";
                    loader.style.display = "none";
                }
            } catch (error) {
                console.error("Login fejl:", error);
                errorDiv.textContent = "Der opstod en netværksfejl. Prøv igen.";
                errorDiv.style.display = "block";
                btn.style.display = "block";
                loader.style.display = "none";
            }
        }

        function afslutLogin() {
            document.getElementById('loginOverlay').style.display = "none";
            document.getElementById('userInfoContainer').style.display = "block";
            document.getElementById('displayUsername').textContent = aktueltNavn;
            loadProgrammer();
        }

        function logUd(event) {
            if(event) event.preventDefault();
            
            localStorage.removeItem('sportlive_user');
            localStorage.removeItem('sportlive_role');
            localStorage.removeItem('sportlive_navn'); 
            localStorage.removeItem('sportlive_passlen'); 
            localStorage.removeItem('sportlive_notif'); 
            
            brugerRolle = "";
            aktuelBruger = "";
            aktueltNavn = "";
            aktuelPassLen = 8;
            aktuelNotifikation = false;
            
            alleProgrammerGlobal = [];
            aktuelleProgrammerVist = [];
            document.getElementById('programTable').style.display = "none";
            document.getElementById('ingenResultater').style.display = "none";
            document.getElementById('userInfoContainer').style.display = "none";
            
            document.getElementById('loginPassword').value = "";
            document.getElementById('btnLogin').style.display = "block";
            document.getElementById('loginLoader').style.display = "none";
            document.getElementById('loginOverlay').style.display = "flex";
            document.getElementById('loginUsername').focus();
        }

        function aabenProfil(e) {
            if(e) e.preventDefault();
            
            document.getElementById('profileView').style.display = 'block';
            document.getElementById('changePasswordView').style.display = 'none';
            document.getElementById('passwordSuccessView').style.display = 'none';
            
            document.getElementById('profileNameText').textContent = aktueltNavn;
            document.getElementById('profileUsernameText').textContent = aktuelBruger;
            
            let pLen = localStorage.getItem('sportlive_passlen') || 8;
            document.getElementById('profilePasswordText').textContent = "*".repeat(pLen);
            
            document.getElementById('profileNotifCheckbox').checked = aktuelNotifikation;
            
            document.getElementById('profileModal').style.display = 'flex';
        }

        function gemProfil() {
            const cb = document.getElementById('profileNotifCheckbox');
            
            if (cb && cb.checked !== aktuelNotifikation) {
                const nyStatus = cb.checked;
                aktuelNotifikation = nyStatus;
                localStorage.setItem('sportlive_notif', nyStatus ? "true" : "false");
                
                fetch(scriptURL, {
                    method: 'POST',
                    body: JSON.stringify({ 
                        action: "update_notification", 
                        username: aktuelBruger,
                        wants_notification: nyStatus
                    }),
                    headers: { 'Content-Type': 'text/plain;charset=utf-8' }
                }).catch(e => console.error("Fejl ved baggrundsopdatering:", e));
            }
            
            document.getElementById('profileModal').style.display = 'none';
        }
        
        async function forsogLukProfil() {
            const cb = document.getElementById('profileNotifCheckbox');
            if (cb && cb.checked !== aktuelNotifikation) {
                const bekræft = await visCustomDialog("Er du sikker på, at du vil afslutte uden at gemme?\n\nEventuelle ugemte indtastninger vil gå tabt.", "confirm");
                if (bekræft) {
                    cb.checked = aktuelNotifikation;
                    document.getElementById('profileModal').style.display = 'none';
                }
            } else {
                document.getElementById('profileModal').style.display = 'none';
            }
        }

        function visSkiftAdgangskode(e) {
            if(e) e.preventDefault();
            document.getElementById('profileView').style.display = 'none';
            document.getElementById('changePasswordView').style.display = 'block';
            document.getElementById('passwordErrorMsg').style.display = 'none';
            
            document.getElementById('inputCurrentPassword').value = '';
            document.getElementById('inputNewPassword').value = '';
            document.getElementById('inputRepeatNewPassword').value = '';
        }

        function visProfilInfo() {
            document.getElementById('profileView').style.display = 'block';
            document.getElementById('changePasswordView').style.display = 'none';
        }

        async function udfoerSkiftAdgangskode() {
            const curPass = document.getElementById('inputCurrentPassword').value;
            const newPass = document.getElementById('inputNewPassword').value;
            const repPass = document.getElementById('inputRepeatNewPassword').value;
            const errorMsg = document.getElementById('passwordErrorMsg');
            const btnConfirm = document.getElementById('btnConfirmPass');
            
            if (!curPass || !newPass || !repPass) {
                errorMsg.textContent = "Udfyld venligst alle felter.";
                errorMsg.style.display = 'block';
                return;
            }
            if (newPass !== repPass) {
                errorMsg.textContent = "De nye adgangskoder er ikke ens.";
                errorMsg.style.display = 'block';
                return;
            }
            
            errorMsg.style.display = 'none';
            const originalText = btnConfirm.textContent;
            btnConfirm.textContent = "Gemmer...";
            btnConfirm.disabled = true;
            
            try {
                const response = await fetch(scriptURL, {
                    method: 'POST',
                    body: JSON.stringify({ 
                        action: "change_password", 
                        username: aktuelBruger,
                        current_password: curPass,
                        new_password: newPass
                    }),
                    headers: { 'Content-Type': 'text/plain;charset=utf-8' }
                });
                
                const result = await response.json();
                
                if (result.success) {
                    document.getElementById('changePasswordView').style.display = 'none';
                    document.getElementById('passwordSuccessView').style.display = 'block';
                    
                    setTimeout(() => {
                        logUd();
                        document.getElementById('profileModal').style.display = 'none';
                    }, 7000);
                } else {
                    errorMsg.textContent = result.message || "Der opstod en fejl.";
                    errorMsg.style.display = 'block';
                }
            } catch (error) {
                console.error(error);
                errorMsg.textContent = "Netværksfejl. Prøv at opdatere siden.";
                errorMsg.style.display = 'block';
            } finally {
                btnConfirm.textContent = originalText;
                btnConfirm.disabled = false;
            }
        }

        document.addEventListener('click', function(e) {
            if (!e.target.closest('.multi-select-container')) {
                const dropdown = document.getElementById('signalDropdown');
                if (dropdown && dropdown.classList.contains('show')) {
                    dropdown.classList.remove('show');
                }
            }
        });

        function toggleMultiSelect() {
            document.getElementById('signalDropdown').classList.toggle('show');
        }

        function updateSignalHeader() {
            const checkboxes = document.querySelectorAll('#signalDropdown input[type="checkbox"]:checked');
            const valgteSignaler = Array.from(checkboxes).map(cb => cb.value).join(', ');
            document.getElementById('signalHeaderText').textContent = valgteSignaler || 'Vælg...';
        }

        function visCustomDialog(message, type) {
            return new Promise((resolve) => {
                const overlay = document.getElementById('customDialog');
                const msgEl = document.getElementById('dialogMessage');
                const actionsEl = document.getElementById('dialogActions');
                
                msgEl.textContent = message;
                actionsEl.innerHTML = ''; 
                
                if (type === 'alert') {
                    const btnOk = document.createElement('button');
                    btnOk.className = 'btn-dialog primary';
                    btnOk.textContent = 'OK';
                    btnOk.onclick = () => { overlay.style.display = 'none'; resolve(true); };
                    actionsEl.appendChild(btnOk);
                } else if (type === 'confirm') {
                    const btnNo = document.createElement('button');
                    btnNo.className = 'btn-dialog secondary';
                    btnNo.textContent = 'Nej, annuller';
                    btnNo.onclick = () => { overlay.style.display = 'none'; resolve(false); };
                    
                    const btnYes = document.createElement('button');
                    btnYes.className = 'btn-dialog primary';
                    btnYes.textContent = 'Ja, fortsæt';
                    btnYes.onclick = () => { overlay.style.display = 'none'; resolve(true); };
                    
                    actionsEl.appendChild(btnNo);
                    actionsEl.appendChild(btnYes);
                } else if (type === 'delete') {
                    const btnNo = document.createElement('button');
                    btnNo.className = 'btn-dialog secondary';
                    btnNo.textContent = 'Annuller';
                    btnNo.onclick = () => { overlay.style.display = 'none'; resolve(false); };
                    
                    const btnYes = document.createElement('button');
                    btnYes.className = 'btn-dialog danger';
                    btnYes.textContent = 'Slet program';
                    btnYes.onclick = () => { overlay.style.display = 'none'; resolve(true); };
                    
                    actionsEl.appendChild(btnNo);
                    actionsEl.appendChild(btnYes);
                }
                
                overlay.style.display = 'flex';
            });
        }

        function opdaterFiltreUI() {
            document.querySelectorAll('.year-option').forEach(el => el.classList.remove('active'));
            if (!visKunIdag) {
                let aktivtAarEl = document.getElementById('year-' + valgtAar);
                if(aktivtAarEl) aktivtAarEl.classList.add('active');
            }

            document.querySelectorAll('.month-btn').forEach(btn => btn.classList.remove('active'));
            if (!visKunIdag) {
                let aktivMaanedEl = document.getElementById('btn-month-' + valgtMaaned);
                if(aktivMaanedEl) aktivMaanedEl.classList.add('active');
            }
            
            const idagBtn = document.getElementById('btn-idag');
            if (visKunIdag) idagBtn.classList.add('active');
            else idagBtn.classList.remove('active');

            const mobileSelect = document.getElementById('mobileMonthFilter');
            if (mobileSelect) {
                if (visKunIdag) {
                    mobileSelect.value = 'idag';
                } else {
                    mobileSelect.value = valgtMaaned.toString();
                }
            }
        }

        function handterFilterSkift() {
            const dropdown = document.getElementById('typeFilter');
            if (dropdown) opdaterVisning();
            const container = document.querySelector('.table-container');
            if (container) container.scrollTop = 0;
        }

        function handterMobileMaanedSkift(val) {
            if (val === 'idag') {
                visKunIdag = true;
                opdaterFiltreUI();
                opdaterVisning();
            } else {
                visKunIdag = false;
                valgtMaaned = parseInt(val);
                opdaterFiltreUI();
                opdaterVisning();
            }
            document.querySelector('.table-container').scrollTop = 0;
        }

        function opdaterTechDatalists() {
            const fieldsMap = {
                'TechMainIP': 'MAIN SRT IP', 'TechMainPort': 'MAIN SRT Port', 'TechMainPass': 'MAIN Passphrase', 'TechMainStreamID': 'MAIN Stream ID',
                'TechBackupIP': 'BACKUP SRT IP', 'TechBackupPort': 'BACKUP SRT Port', 'TechBackupPass': 'BACKUP Passphrase', 'TechBackupStreamID': 'BACKUP Stream ID',
                'TechSrtListenerIP': 'SRT Listener IP', 'TechSrtListenerPort': 'SRT Listener Port', 'TechSrtListenerPass': 'SRT Listener Passphrase', 'TechSrtListenerStreamID': 'SRT Listener Stream ID',
                'TechBrtListenerIP': 'BRT Listener IP', 'TechBrtListenerPort': 'BRT Listener Port', 'TechBrtListenerPass': 'BRT Listener Passphrase', 'TechBrtListenerStreamID': 'BRT Listener Stream ID',
                'TechMcrTlf': 'MCR telefon', 'TechMcrEmail': 'MCR e-mail', 'TechMcrTitel': 'MCR titel',
                'TechKontakt1Tlf': 'Kontakt 1 telefon', 'TechKontakt1Email': 'Kontakt 1 e-mail', 'TechKontakt1Titel': 'Kontakt 1 titel',
                'TechKontakt2Tlf': 'Kontakt 2 telefon', 'TechKontakt2Email': 'Kontakt 2 e-mail', 'TechKontakt2Titel': 'Kontakt 2 titel'
            };

            for (const [elementId, dbKey] of Object.entries(fieldsMap)) {
                const datalist = document.getElementById('liste-' + elementId);
                if (datalist) {
                    const uniqueValues = [...new Set(alleProgrammerGlobal.map(p => p[dbKey]).filter(val => val && String(val).trim() !== ''))].sort();
                    
                    datalist.innerHTML = '';
                    uniqueValues.forEach(val => {
                        const option = document.createElement('option');
                        option.value = String(val).trim();
                        datalist.appendChild(option);
                    });
                }
            }
        }

        function opdaterTechLinks() {
            const tekst = document.getElementById('TechYderligere').value;
            const container = document.getElementById('TechYderligereLinks');
            if (!container) return;
            container.innerHTML = ''; 

            const urlRegex = /(https?:\/\/[^\s]+)/g;
            const links = tekst.match(urlRegex);

            if (links && links.length > 0) {
                const unikkeLinks = [...new Set(links)];
                unikkeLinks.forEach(url => {
                    const a = document.createElement('a');
                    a.href = url;
                    a.target = '_blank';
                    const visningsTekst = url.length > 60 ? url.substring(0, 57) + '...' : url;
                    a.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-right: 6px;"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>${visningsTekst}`;
                    a.style.color = '#0056b3';
                    a.style.fontSize = '13px';
                    a.style.textDecoration = 'none';
                    a.style.fontWeight = '500';
                    a.style.display = 'inline-flex';
                    a.style.alignItems = 'center';
                    a.style.padding = '6px 10px';
                    a.style.backgroundColor = '#e8f4fd';
                    a.style.borderRadius = '4px';
                    a.style.border = '1px solid #b8daff';
                    a.style.width = 'fit-content';
                    
                    a.onmouseover = function() { this.style.backgroundColor = '#d1e7fd'; this.style.textDecoration = 'underline'; };
                    a.onmouseout = function() { this.style.backgroundColor = '#e8f4fd'; this.style.textDecoration = 'none'; };

                    container.appendChild(a);
                });
            }
        }

        // --- MANGLENDE KOPIER/SÆT IND FUNKTIONER ER NU RETUR ---
        function kopierTechOpsaetning() {
            kopieretTechOpsaetning = {
                "Format": document.getElementById('TechFormat').value,
                "RX": document.getElementById('TechRX').value,
                "MAIN SRT IP": document.getElementById('TechMainIP').value,
                "MAIN SRT Port": document.getElementById('TechMainPort').value,
                "MAIN Passphrase": document.getElementById('TechMainPass').value,
                "MAIN Stream ID": document.getElementById('TechMainStreamID').value,
                "BACKUP SRT IP": document.getElementById('TechBackupIP').value,
                "BACKUP SRT Port": document.getElementById('TechBackupPort').value,
                "BACKUP Passphrase": document.getElementById('TechBackupPass').value,
                "BACKUP Stream ID": document.getElementById('TechBackupStreamID').value,
                "SRT Listener": document.getElementById('TechSrtListener').checked,
                "SRT Listener IP": document.getElementById('TechSrtListenerIP').value,
                "SRT Listener Port": document.getElementById('TechSrtListenerPort').value,
                "SRT Listener Passphrase": document.getElementById('TechSrtListenerPass').value,
                "SRT Listener Stream ID": document.getElementById('TechSrtListenerStreamID').value,
                "BRT Listener": document.getElementById('TechBrtListener').checked,
                "BRT Listener IP": document.getElementById('TechBrtListenerIP').value,
                "BRT Listener Port": document.getElementById('TechBrtListenerPort').value,
                "BRT Listener Passphrase": document.getElementById('TechBrtListenerPass').value,
                "BRT Listener Stream ID": document.getElementById('TechBrtListenerStreamID').value,
                "A1": document.getElementById('TechA1').value,
                "A2": document.getElementById('TechA2').value,
                "A3": document.getElementById('TechA3').value,
                "A4": document.getElementById('TechA4').value,
                "A5": document.getElementById('TechA5').value,
                "A6": document.getElementById('TechA6').value,
                "E2E Test": document.getElementById('TechE2ETest').checked,
                "UTC start": document.getElementById('TechUtcStart').value,
                "UTC slut": document.getElementById('TechUtcSlut').value,
                "MCR telefon": document.getElementById('TechMcrTlf').value,
                "MCR e-mail": document.getElementById('TechMcrEmail').value,
                "MCR titel": document.getElementById('TechMcrTitel').value,
                "Kontakt 1 telefon": document.getElementById('TechKontakt1Tlf').value,
                "Kontakt 1 e-mail": document.getElementById('TechKontakt1Email').value,
                "Kontakt 1 titel": document.getElementById('TechKontakt1Titel').value,
                "Kontakt 2 telefon": document.getElementById('TechKontakt2Tlf').value,
                "Kontakt 2 e-mail": document.getElementById('TechKontakt2Email').value,
                "Kontakt 2 titel": document.getElementById('TechKontakt2Titel').value,
                "Yderligere info": document.getElementById('TechYderligere').value
            };
            
            const btn = document.getElementById('btnKopierTech');
            const orgText = btn.innerHTML;
            btn.innerHTML = '✔ Kopieret';
            btn.style.backgroundColor = '#218838';
            setTimeout(() => {
                btn.innerHTML = orgText;
                btn.style.backgroundColor = '#6c757d';
            }, 1500);

            const btnSaetInd = document.getElementById('btnSaetIndTech');
            if (btnSaetInd) {
                btnSaetInd.disabled = false;
                btnSaetInd.style.opacity = '1';
            }
        }

        function saetIndTechOpsaetning() {
            if (!kopieretTechOpsaetning) return;

            document.getElementById('TechFormat').value = kopieretTechOpsaetning["Format"];
            document.getElementById('TechRX').value = kopieretTechOpsaetning["RX"];
            
            document.getElementById('TechMainIP').value = kopieretTechOpsaetning["MAIN SRT IP"];
            document.getElementById('TechMainPort').value = kopieretTechOpsaetning["MAIN SRT Port"];
            document.getElementById('TechMainPass').value = kopieretTechOpsaetning["MAIN Passphrase"];
            document.getElementById('TechMainStreamID').value = kopieretTechOpsaetning["MAIN Stream ID"];
            
            document.getElementById('TechBackupIP').value = kopieretTechOpsaetning["BACKUP SRT IP"];
            document.getElementById('TechBackupPort').value = kopieretTechOpsaetning["BACKUP SRT Port"];
            document.getElementById('TechBackupPass').value = kopieretTechOpsaetning["BACKUP Passphrase"];
            document.getElementById('TechBackupStreamID').value = kopieretTechOpsaetning["BACKUP Stream ID"];
            
            document.getElementById('TechSrtListener').checked = kopieretTechOpsaetning["SRT Listener"];
            document.getElementById('TechSrtListenerIP').value = kopieretTechOpsaetning["SRT Listener IP"];
            document.getElementById('TechSrtListenerPort').value = kopieretTechOpsaetning["SRT Listener Port"];
            document.getElementById('TechSrtListenerPass').value = kopieretTechOpsaetning["SRT Listener Passphrase"];
            document.getElementById('TechSrtListenerStreamID').value = kopieretTechOpsaetning["SRT Listener Stream ID"];
            
            document.getElementById('TechBrtListener').checked = kopieretTechOpsaetning["BRT Listener"];
            document.getElementById('TechBrtListenerIP').value = kopieretTechOpsaetning["BRT Listener IP"];
            document.getElementById('TechBrtListenerPort').value = kopieretTechOpsaetning["BRT Listener Port"];
            document.getElementById('TechBrtListenerPass').value = kopieretTechOpsaetning["BRT Listener Passphrase"];
            document.getElementById('TechBrtListenerStreamID').value = kopieretTechOpsaetning["BRT Listener Stream ID"];
            
            document.getElementById('TechA1').value = kopieretTechOpsaetning["A1"];
            document.getElementById('TechA2').value = kopieretTechOpsaetning["A2"];
            document.getElementById('TechA3').value = kopieretTechOpsaetning["A3"];
            document.getElementById('TechA4').value = kopieretTechOpsaetning["A4"];
            document.getElementById('TechA5').value = kopieretTechOpsaetning["A5"];
            document.getElementById('TechA6').value = kopieretTechOpsaetning["A6"];
            
            document.getElementById('TechE2ETest').checked = kopieretTechOpsaetning["E2E Test"];
            document.getElementById('TechUtcStart').value = kopieretTechOpsaetning["UTC start"];
            document.getElementById('TechUtcSlut').value = kopieretTechOpsaetning["UTC slut"];
            
            document.getElementById('TechMcrTlf').value = kopieretTechOpsaetning["MCR telefon"];
            document.getElementById('TechMcrEmail').value = kopieretTechOpsaetning["MCR e-mail"];
            document.getElementById('TechMcrTitel').value = kopieretTechOpsaetning["MCR titel"];
            
            document.getElementById('TechKontakt1Tlf').value = kopieretTechOpsaetning["Kontakt 1 telefon"];
            document.getElementById('TechKontakt1Email').value = kopieretTechOpsaetning["Kontakt 1 e-mail"];
            document.getElementById('TechKontakt1Titel').value = kopieretTechOpsaetning["Kontakt 1 titel"];
            
            document.getElementById('TechKontakt2Tlf').value = kopieretTechOpsaetning["Kontakt 2 telefon"];
            document.getElementById('TechKontakt2Email').value = kopieretTechOpsaetning["Kontakt 2 e-mail"];
            document.getElementById('TechKontakt2Titel').value = kopieretTechOpsaetning["Kontakt 2 titel"];
            
            document.getElementById('TechYderligere').value = kopieretTechOpsaetning["Yderligere info"];

            toggleTechListeners();
            calcE2ETime();
            opdaterTechLinks(); // Sikrer at knapperne til links også opdateres automatisk

            const btn = document.getElementById('btnSaetIndTech');
            const orgText = btn.innerHTML;
            btn.innerHTML = '✔ Sat ind';
            setTimeout(() => {
                btn.innerHTML = orgText;
            }, 1500);
        }

        async function rydTechOpsaetning() {
            const bekraeft = await visCustomDialog("Er du sikker på, at du vil slette alt indhold i dette vindue?", "confirm");
            if (!bekraeft) return;

            const textFields = [
                'TechFormat', 'TechRX', 'TechMainIP', 'TechMainPort', 'TechMainPass', 'TechMainStreamID',
                'TechBackupIP', 'TechBackupPort', 'TechBackupPass', 'TechBackupStreamID',
                'TechSrtListenerIP', 'TechSrtListenerPort', 'TechSrtListenerPass', 'TechSrtListenerStreamID', 
                'TechBrtListenerIP', 'TechBrtListenerPort', 'TechBrtListenerPass', 'TechBrtListenerStreamID',
                'TechA1', 'TechA2', 'TechA3', 'TechA4', 'TechA5', 'TechA6',
                'TechUtcStart', 'TechUtcSlut', 'TechMcrTitel', 'TechMcrTlf', 'TechMcrEmail',
                'TechKontakt1Titel', 'TechKontakt1Tlf', 'TechKontakt1Email',
                'TechKontakt2Titel', 'TechKontakt2Tlf', 'TechKontakt2Email', 'TechYderligere'
            ];
            
            for (let id of textFields) {
                const el = document.getElementById(id);
                if (el) el.value = '';
            }
            
            document.getElementById('TechSrtListener').checked = false;
            document.getElementById('TechBrtListener').checked = false;
            document.getElementById('TechE2ETest').checked = false;
            
            toggleTechListeners();
            calcE2ETime();
            opdaterTechLinks(); // Rydder også de genererede links i bunden
        }
        // -----------------------------------------------------------

        async function loadProgrammer(silent = false) {
            if (!silent) {
                document.getElementById('loader').style.display = 'block';
                document.getElementById('programTable').style.display = 'none';
                document.getElementById('ingenResultater').style.display = 'none';
            }
            
            try {
                const getUrl = scriptURL + "?action=getdata";
                const response = await fetch(getUrl);
                const jsonData = await response.json();
                
                let raaProgrammer = jsonData.programmer || [];
                
                alleProgrammerGlobal = raaProgrammer.map(p => {
                    if (p["Dato"]) {
                        const d = new Date(p["Dato"]);
                        if (!isNaN(d.getTime())) {
                            p["NormDato"] = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, '0') + "-" + String(d.getDate()).padStart(2, '0');
                        } else { p["NormDato"] = p["Dato"]; }
                    } else { p["NormDato"] = ""; }
                    return p;
                });

                const dropdowns = jsonData.dropdowns || {};

                for (const [feltNavn, muligheder] of Object.entries(dropdowns)) {
                    if (feltNavn === 'Signal til' || feltNavn === 'Sling') {
                        const signalDropdown = document.getElementById('signalDropdown');
                        if (signalDropdown) {
                            signalDropdown.innerHTML = '';
                            muligheder.forEach(mulighed => {
                                const div = document.createElement('div');
                                div.className = 'multi-select-option';
                                
                                const cb = document.createElement('input');
                                cb.type = 'checkbox';
                                cb.value = mulighed;
                                cb.id = 'sig-' + mulighed.replace(/\s+/g, '-');
                                cb.onchange = updateSignalHeader;
                                
                                const lbl = document.createElement('label');
                                lbl.htmlFor = cb.id;
                                lbl.textContent = mulighed;
                                
                                div.appendChild(cb);
                                div.appendChild(lbl);
                                signalDropdown.appendChild(div);
                            });
                        }
                    } else if (feltNavn !== 'Produktionsplan' && feltNavn !== 'P-plan' && feltNavn !== 'Teknisk info') {
                        // Inkluderer nu også den nye "Audio layout"-datalist fra Sheets
                        const datalistElement = document.getElementById('liste-' + feltNavn);
                        if (datalistElement) {
                            datalistElement.innerHTML = ''; 
                            muligheder.forEach(mulighed => {
                                const option = document.createElement('option');
                                option.value = mulighed;
                                datalistElement.appendChild(option);
                            });
                        }
                    }
                }

                alleProgrammerGlobal.sort((a, b) => {
                    const datoA = a["NormDato"] || "";
                    const datoB = b["NormDato"] || "";
                    if (datoA !== datoB) return datoA.localeCompare(datoB);
                    const tidA = a["Tid"] || "23:59";
                    const tidB = b["Tid"] || "23:59";
                    return tidA.localeCompare(tidB);
                });

                opdaterFiltreUI();
                opdaterVisning();
                opdaterTechDatalists();

                if (!silent) {
                    document.getElementById('loader').style.display = 'none';
                }

            } catch (error) {
                console.error('Fejl ved indlæsning:', error);
                if (!silent) {
                    document.getElementById('loader').textContent = "Der opstod en fejl under indlæsning af programmer.";
                    document.getElementById('loader').style.display = 'block';
                }
            }
        }

        function filtrerAar(aar) {
            visKunIdag = false; 
            valgtAar = aar;
            const aktueltAar = aktuelDato.getFullYear();
            if (aar === aktueltAar) valgtMaaned = aktuelDato.getMonth();
            else valgtMaaned = 0; 
            opdaterFiltreUI();
            opdaterVisning();
            document.querySelector('.table-container').scrollTop = 0;
        }

        function filtrerMaaned(maanedIndex) {
            visKunIdag = false; 
            valgtMaaned = maanedIndex;
            opdaterFiltreUI();
            opdaterVisning();
            document.querySelector('.table-container').scrollTop = 0;
        }

        function filtrerIdag() {
            visKunIdag = !visKunIdag; 
            opdaterFiltreUI();
            opdaterVisning();
            document.querySelector('.table-container').scrollTop = 0;
        }

        function handterSogning() {
            const input = document.getElementById('searchInput').value.trim();
            const clearBtn = document.getElementById('clearSearchBtn');
            clearBtn.style.display = input.length > 0 ? 'block' : 'none';
            opdaterVisning();
            const container = document.querySelector('.table-container');
            if (container) container.scrollTop = 0;
        }

        function rydSogning() {
            const input = document.getElementById('searchInput');
            input.value = '';
            document.getElementById('clearSearchBtn').style.display = 'none';
            opdaterVisning();
            const container = document.querySelector('.table-container');
            if (container) container.scrollTop = 0;
        }

        function opdaterVisning() {
            const searchTerm = document.getElementById('searchInput').value.toLowerCase().trim();
            const kategoriFilter = document.getElementById('typeFilter').value;
            
            const pdfBtn = document.getElementById('btnExportPDF');
            if (pdfBtn) {
                if (valgtMaaned !== -1 && kategoriFilter === 'sportlive' && !visKunIdag) {
                    pdfBtn.style.display = 'inline-flex';
                } else {
                    pdfBtn.style.display = 'none';
                }
            }

            const sysDato = new Date();
            const idagsDatoStr = sysDato.getFullYear() + "-" + String(sysDato.getMonth() + 1).padStart(2, '0') + "-" + String(sysDato.getDate()).padStart(2, '0');

            aktuelleProgrammerVist = alleProgrammerGlobal.filter(program => {
                const normDato = program["NormDato"] || "";
                if (!normDato) return false;
                
                if (visKunIdag) {
                    if (normDato !== idagsDatoStr) return false;
                } else {
                    const parts = normDato.split('-');
                    const pAar = parseInt(parts[0], 10);
                    const pMaaned = parseInt(parts[1], 10) - 1; 
                    
                    if (pAar !== valgtAar) return false;
                    if (valgtMaaned !== -1 && pMaaned !== valgtMaaned) return false;
                }
                
                const kanalNavn = String(program["Kanal"] || '');
                const unitNavn = String(program["Unit"] || '');
                
                if (kategoriFilter === 'fremtidige' && normDato < idagsDatoStr) return false;
                if (kategoriFilter === 'sportlive' && kanalNavn !== 'SPORT LIVE' && kanalNavn !== 'Optagelse') return false;
                if (kategoriFilter === 'ekstern' && (kanalNavn === 'SPORT LIVE' || kanalNavn === 'Optagelse')) return false;
                
                if (kategoriFilter === 'ob') {
                    const obFilterArr = ["MINITECH", "NOWTEK OB1", "NOWTEK OB2", "OB 7", "OB 9", "OB 7+9", "SAM OB", "OB"];
                    if (!obFilterArr.includes(unitNavn.toUpperCase())) return false;
                }

                if (kategoriFilter === 'tbc' && (!program["TBC"] || String(program["TBC"]).toUpperCase() !== 'X')) return false;
                
                if (searchTerm !== '') {
                    const alleFelterTekst = Object.values(program).map(v => String(v)).join(' ').toLowerCase();
                    if (!alleFelterTekst.includes(searchTerm)) { return false; }
                }
                return true;
            });
            
            const countEl = document.getElementById('programCountText');
            if (countEl) {
                countEl.innerHTML = `Viser <b>${aktuelleProgrammerVist.length}</b> programmer`;
            }
            
            tegnTabel(aktuelleProgrammerVist);
        }

        function toggleDetails(btn) {
            const trMain = btn.closest('tr');
            const trDetail = trMain.nextElementSibling;
            
            const isOpening = (trDetail.style.display === 'none' || trDetail.style.display === '');

            document.querySelectorAll('.detail-row').forEach(row => {
                row.style.display = 'none';
                const prev = row.previousElementSibling;
                if (prev) {
                    const toggleBtn = prev.querySelector('.toggle-btn');
                    if (toggleBtn) toggleBtn.textContent = '▼';
                }
            });
            
            if (isOpening) {
                trDetail.style.display = 'table-row';
                btn.textContent = '▲'; 
                
                setTimeout(() => {
                    const container = document.querySelector('.table-container');
                    const detailRect = trDetail.getBoundingClientRect();
                    const containerRect = container.getBoundingClientRect();
                    
                    if (detailRect.bottom > containerRect.bottom) {
                        container.scrollBy({
                            top: (detailRect.bottom - containerRect.bottom) + 15,
                            behavior: 'smooth'
                        });
                    }
                }, 50);
            }
        }

        function toggleDetailsFromRow(event, row) {
            if (event.target.tagName === 'BUTTON' || event.target.closest('button')) return;
            
            const trDetail = row.nextElementSibling;
            const isOpening = (trDetail.style.display === 'none' || trDetail.style.display === '');

            document.querySelectorAll('.detail-row').forEach(detailRow => {
                detailRow.style.display = 'none';
                const prev = detailRow.previousElementSibling;
                if (prev) {
                    const toggleBtn = prev.querySelector('.toggle-btn');
                    if (toggleBtn) toggleBtn.textContent = '▼';
                }
            });

            if (isOpening) {
                trDetail.style.display = 'table-row';
                const btn = row.querySelector('.toggle-btn');
                if (btn) btn.textContent = '▲';
                
                setTimeout(() => {
                    const container = document.querySelector('.table-container');
                    const detailRect = trDetail.getBoundingClientRect();
                    const containerRect = container.getBoundingClientRect();
                    
                    if (detailRect.bottom > containerRect.bottom) {
                        container.scrollBy({
                            top: (detailRect.bottom - containerRect.bottom) + 15,
                            behavior: 'smooth'
                        });
                    }
                }, 50);
            }
        }

        async function forsogLukModal() {
            if (hentFormularState() !== formInitialState) {
                const bekræft = await visCustomDialog("Er du sikker på, at du vil afslutte uden at gemme?\n\nEventuelle ugemte indtastninger vil gå tabt.", "confirm");
                if (bekræft) { closeModal(); }
            } else {
                closeModal();
            }
        }

        function hentTechFormularState() {
            const data = {};
            const textFields = [
                'TechFormat', 'TechRX', 'TechMainIP', 'TechMainPort', 'TechMainPass', 'TechMainStreamID',
                'TechBackupIP', 'TechBackupPort', 'TechBackupPass', 'TechBackupStreamID',
                'TechSrtListenerIP', 'TechSrtListenerPort', 'TechSrtListenerPass', 'TechSrtListenerStreamID', 
                'TechBrtListenerIP', 'TechBrtListenerPort', 'TechBrtListenerPass', 'TechBrtListenerStreamID',
                'TechA1', 'TechA2', 'TechA3', 'TechA4', 'TechA5', 'TechA6',
                'TechUtcStart', 'TechUtcSlut', 'TechMcrTitel', 'TechMcrTlf', 'TechMcrEmail',
                'TechKontakt1Titel', 'TechKontakt1Tlf', 'TechKontakt1Email',
                'TechKontakt2Titel', 'TechKontakt2Tlf', 'TechKontakt2Email', 'TechYderligere'
            ];
            for (let id of textFields) {
                const el = document.getElementById(id);
                if (el) data[id] = el.value;
            }
            data['TechSrtListener'] = document.getElementById('TechSrtListener').checked;
            data['TechBrtListener'] = document.getElementById('TechBrtListener').checked;
            data['TechE2ETest'] = document.getElementById('TechE2ETest').checked;
            return JSON.stringify(data);
        }
        
        function kopierTekst(elementId, btnElement) {
            const el = document.getElementById(elementId);
            if (!el || !el.value) return;
            navigator.clipboard.writeText(el.value).then(() => {
                const originalHtml = btnElement.innerHTML;
                btnElement.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" stroke="#28a745" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';
                setTimeout(() => { btnElement.innerHTML = originalHtml; }, 1500);
            }).catch(err => console.error("Kopiering fejlede:", err));
        }

        function toggleTechListeners() {
            const srtBox = document.getElementById('TechSrtListener');
            const srtGroup = document.getElementById('TechSrtListenerGroup');
            srtGroup.style.display = srtBox.checked ? 'grid' : 'none';

            const brtBox = document.getElementById('TechBrtListener');
            const brtGroup = document.getElementById('TechBrtListenerGroup');
            brtGroup.style.display = brtBox.checked ? 'grid' : 'none';
            
            const e2eBox = document.getElementById('TechE2ETest');
            const e2eGroup = document.getElementById('TechE2ETestGroup');
            if (e2eGroup) e2eGroup.style.display = e2eBox.checked ? 'grid' : 'none';
        }

        function calcE2ETime() {
            const rowId = document.getElementById('TechRowId').value;
            const program = alleProgrammerGlobal.find(p => String(p.RowId) === String(rowId));
            const datoStr = (program && program.NormDato) ? program.NormDato : new Date().toISOString().split('T')[0];

            const tzTestDate = new Date(`${datoStr}T12:00:00Z`);
            const formatter = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Copenhagen', timeZoneName: 'short' });
            const tzPart = formatter.formatToParts(tzTestDate).find(p => p.type === 'timeZoneName');
            const isSummertime = tzPart && (tzPart.value.includes('+2') || tzPart.value.includes('CEST') || tzPart.value.includes('GMT+2'));
            const offset = isSummertime ? 2 : 1;
            const tzNavn = isSummertime ? "CEST" : "CET";

            ['Start', 'Slut'].forEach(type => {
                const utcVal = document.getElementById(`TechUtc${type}`).value;
                const cetDiv = document.getElementById(`TechCet${type}`);
                
                if (!utcVal) {
                    cetDiv.innerHTML = "";
                    return;
                }
                
                let [t, m] = utcVal.split(':').map(Number);
                t = t + offset;
                if (t >= 24) t -= 24;
                
                const flagSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 37 28" width="16" height="12" style="vertical-align: middle; margin-right: 5px; border-radius: 2px; box-shadow: 0 0 1px rgba(0,0,0,0.4); position: relative; top: -2px;"><rect width="37" height="28" fill="#c8102e"/><rect x="12" y="0" width="4" height="28" fill="#fff"/><rect x="0" y="12" width="37" height="4" fill="#fff"/></svg>`;
                
                cetDiv.innerHTML = `${flagSvg} ${tzNavn} ${type.toLowerCase()}: ${String(t).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
            });
        }

        async function aabenTechModal(event, rowId) {
            event.preventDefault();
            if (brugerRolle !== "Admin") {
                await visCustomDialog("Du har ikke tilladelse til at udføre denne handling.", "alert");
                return;
            }
            
            document.getElementById('TechRowId').value = rowId;
            const program = alleProgrammerGlobal.find(p => String(p.RowId) === String(rowId));
            
            if (!program) return;

            const programTitleForModal = program["Programtitel"] ? program["Programtitel"] : "Ukendt program";
            document.getElementById('techModalTitle').textContent = `Teknisk info | ${programTitleForModal}`;

            document.getElementById('TechFormat').value = program["Format"] || '';
            document.getElementById('TechRX').value = program["RX"] || '';
            
            document.getElementById('TechMainIP').value = program["MAIN SRT IP"] || '';
            document.getElementById('TechMainPort').value = program["MAIN SRT Port"] || '';
            document.getElementById('TechMainPass').value = program["MAIN Passphrase"] || '';
            document.getElementById('TechMainStreamID').value = program["MAIN Stream ID"] || '';
            
            document.getElementById('TechBackupIP').value = program["BACKUP SRT IP"] || '';
            document.getElementById('TechBackupPort').value = program["BACKUP SRT Port"] || '';
            document.getElementById('TechBackupPass').value = program["BACKUP Passphrase"] || '';
            document.getElementById('TechBackupStreamID').value = program["BACKUP Stream ID"] || '';
            
            document.getElementById('TechSrtListener').checked = (program["SRT Listener"] === "X");
            document.getElementById('TechSrtListenerIP').value = program["SRT Listener IP"] || '';
            document.getElementById('TechSrtListenerPort').value = program["SRT Listener Port"] || '';
            document.getElementById('TechSrtListenerPass').value = program["SRT Listener Passphrase"] || '';
            document.getElementById('TechSrtListenerStreamID').value = program["SRT Listener Stream ID"] || '';
            
            document.getElementById('TechBrtListener').checked = (program["BRT Listener"] === "X");
            document.getElementById('TechBrtListenerIP').value = program["BRT Listener IP"] || '';
            document.getElementById('TechBrtListenerPort').value = program["BRT Listener Port"] || '';
            document.getElementById('TechBrtListenerPass').value = program["BRT Listener Passphrase"] || '';
            document.getElementById('TechBrtListenerStreamID').value = program["BRT Listener Stream ID"] || '';
            
            for(let i=1; i<=6; i++) {
                document.getElementById('TechA'+i).value = program["A"+i] || '';
            }
            
            document.getElementById('TechUtcStart').value = program["UTC start"] || '';
            document.getElementById('TechUtcSlut').value = program["UTC slut"] || '';
            
            document.getElementById('TechE2ETest').checked = (program["UTC start"] || program["UTC slut"]) ? true : false;
            
            toggleTechListeners(); 
            calcE2ETime(); 
            
            document.getElementById('TechMcrTitel').value = program["MCR titel"] || '';
            document.getElementById('TechMcrTlf').value = program["MCR telefon"] || '';
            document.getElementById('TechMcrEmail').value = program["MCR e-mail"] || '';
            
            document.getElementById('TechKontakt1Titel').value = program["Kontakt 1 titel"] || '';
            document.getElementById('TechKontakt1Tlf').value = program["Kontakt 1 telefon"] || '';
            document.getElementById('TechKontakt1Email').value = program["Kontakt 1 e-mail"] || '';
            
            document.getElementById('TechKontakt2Titel').value = program["Kontakt 2 titel"] || '';
            document.getElementById('TechKontakt2Tlf').value = program["Kontakt 2 telefon"] || '';
            document.getElementById('TechKontakt2Email').value = program["Kontakt 2 e-mail"] || '';
            
            document.getElementById('TechYderligere').value = program["Yderligere info"] || '';
            opdaterTechLinks();
            
            techFormInitialState = hentTechFormularState();

            const hasData = (program["MAIN SRT IP"] || program["Format"] || program["UTC start"] || program["MCR telefon"]);
            const submitBtn = document.getElementById('btnTechSubmit');
            submitBtn.textContent = hasData ? "Opdater teknisk info" : "Gem teknisk info";

            const btnSaetInd = document.getElementById('btnSaetIndTech');
            if (kopieretTechOpsaetning) {
                btnSaetInd.disabled = false;
                btnSaetInd.style.opacity = '1';
            } else {
                btnSaetInd.disabled = true;
                btnSaetInd.style.opacity = '0.5';
            }
            
            document.getElementById('techModal').style.display = "block";
            
            document.getElementById('techModal').scrollTop = 0;
        }

        async function forsogLukTechModal() {
            if (hentTechFormularState() !== techFormInitialState) {
                const bekræft = await visCustomDialog("Er du sikker på, at du vil afslutte uden at gemme?\n\nEventuelle ugemte indtastninger vil gå tabt.", "confirm");
                if (bekræft) { document.getElementById('techModal').style.display = "none"; }
            } else {
                document.getElementById('techModal').style.display = "none";
            }
        }

        async function gemTechInfo() {
            if (hentTechFormularState() === techFormInitialState) {
                document.getElementById('techModal').style.display = "none";
                return;
            }

            const rowId = document.getElementById('TechRowId').value;
            if (!rowId) return;

            const submitBtn = document.getElementById('btnTechSubmit');
            const originalText = submitBtn.textContent;
            submitBtn.textContent = "Gemmer...";
            submitBtn.disabled = true;

            const techPayload = {
                action: "update",
                RowId: rowId,
                "Format": document.getElementById('TechFormat').value,
                "RX": document.getElementById('TechRX').value,
                "MAIN SRT IP": document.getElementById('TechMainIP').value,
                "MAIN SRT Port": document.getElementById('TechMainPort').value,
                "MAIN Passphrase": document.getElementById('TechMainPass').value,
                "MAIN Stream ID": document.getElementById('TechMainStreamID').value,
                "BACKUP SRT IP": document.getElementById('TechBackupIP').value,
                "BACKUP SRT Port": document.getElementById('TechBackupPort').value,
                "BACKUP Passphrase": document.getElementById('TechBackupPass').value,
                "BACKUP Stream ID": document.getElementById('TechBackupStreamID').value,
                "SRT Listener": document.getElementById('TechSrtListener').checked ? "X" : "",
                "SRT Listener IP": document.getElementById('TechSrtListenerIP').value,
                "SRT Listener Port": document.getElementById('TechSrtListenerPort').value,
                "SRT Listener Passphrase": document.getElementById('TechSrtListenerPass').value,
                "SRT Listener Stream ID": document.getElementById('TechSrtListenerStreamID').value,
                "BRT Listener": document.getElementById('TechBrtListener').checked ? "X" : "",
                "BRT Listener IP": document.getElementById('TechBrtListenerIP').value,
                "BRT Listener Port": document.getElementById('TechBrtListenerPort').value,
                "BRT Listener Passphrase": document.getElementById('TechBrtListenerPass').value,
                "BRT Listener Stream ID": document.getElementById('TechBrtListenerStreamID').value,
                "A1": document.getElementById('TechA1').value,
                "A2": document.getElementById('TechA2').value,
                "A3": document.getElementById('TechA3').value,
                "A4": document.getElementById('TechA4').value,
                "A5": document.getElementById('TechA5').value,
                "A6": document.getElementById('TechA6').value,
                "UTC start": document.getElementById('TechE2ETest').checked ? document.getElementById('TechUtcStart').value : "",
                "UTC slut": document.getElementById('TechE2ETest').checked ? document.getElementById('TechUtcSlut').value : "",
                "MCR titel": document.getElementById('TechMcrTitel').value,
                "MCR telefon": document.getElementById('TechMcrTlf').value,
                "MCR e-mail": document.getElementById('TechMcrEmail').value,
                "Kontakt 1 titel": document.getElementById('TechKontakt1Titel').value,
                "Kontakt 1 telefon": document.getElementById('TechKontakt1Tlf').value,
                "Kontakt 1 e-mail": document.getElementById('TechKontakt1Email').value,
                "Kontakt 2 titel": document.getElementById('TechKontakt2Titel').value,
                "Kontakt 2 telefon": document.getElementById('TechKontakt2Tlf').value,
                "Kontakt 2 e-mail": document.getElementById('TechKontakt2Email').value,
                "Yderligere info": document.getElementById('TechYderligere').value
            };

            try {
                await fetch(scriptURL, {
                    method: 'POST',
                    body: JSON.stringify(techPayload),
                    headers: { 'Content-Type': 'text/plain;charset=utf-8' }
                });
                
                const program = alleProgrammerGlobal.find(p => String(p.RowId) === String(rowId));
                if (program) {
                    for (let key in techPayload) {
                        if (key !== "action" && key !== "RowId") {
                            program[key] = techPayload[key];
                        }
                    }
                    opdaterVisning(); 
                }

                document.getElementById('techModal').style.display = "none";
                
            } catch (error) {
                console.error('Fejl ved gemning af tech info:', error);
                await visCustomDialog("Der skete en fejl under gemning. Prøv igen.", 'alert');
            } finally {
                submitBtn.textContent = originalText;
                submitBtn.disabled = false;
            }
        }

        async function opretNytProgram() {
            if (brugerRolle !== "Admin") {
                await visCustomDialog("Du har ikke tilladelse til at udføre denne handling.", "alert");
                return;
            }

            document.getElementById('programForm').reset();
            document.getElementById('RowId').value = ""; 
            
            document.getElementById('group-Premieredato').style.display = 'none';
            document.getElementById('Premieredato').value = '';

            document.querySelectorAll('#signalDropdown input[type="checkbox"]').forEach(cb => cb.checked = false);
            updateSignalHeader();
            
            document.getElementById('modalTitle').textContent = "Tilføj nyt program";
            document.getElementById('submitBtn').textContent = "Gem program";
            
            if (valgtAar && !visKunIdag) {
                const defaultDate = new Date();
                defaultDate.setFullYear(valgtAar);
                document.getElementById('Dato').value = valgtAar + "-" + String(defaultDate.getMonth() + 1).padStart(2, '0') + "-" + String(defaultDate.getDate()).padStart(2, '0');
            } else if (visKunIdag) {
                const sysDato = new Date();
                document.getElementById('Dato').value = sysDato.getFullYear() + "-" + String(sysDato.getMonth() + 1).padStart(2, '0') + "-" + String(sysDato.getDate()).padStart(2, '0');
            }

            formInitialState = hentFormularState();
            pendingTechInfoForNewProgram = null;
            openModal();
        }

        function skalViseAdvarsel(program) {
            const normDato = program["NormDato"] || "";
            if (!normDato) return false;

            const sysDato = new Date();
            sysDato.setHours(0, 0, 0, 0);
            
            const pDato = new Date(normDato);
            pDato.setHours(0, 0, 0, 0);
            
            if (pDato < sysDato) return false;
            
            const slutNæsteMaaned = new Date(sysDato.getFullYear(), sysDato.getMonth() + 2, 0);
            slutNæsteMaaned.setHours(23, 59, 59, 999);
            
            if (pDato > slutNæsteMaaned) return false;

            if (program["TBC"] && String(program["TBC"]).toUpperCase() === 'X') {
                return false;
            }

            const unit = String(program["Unit"] || "");
            const kanal = String(program["Kanal"] || "");
            const manglerKommentator = (!program["Kommentator"] || String(program["Kommentator"]).trim() === "");
            const manglerReporter = (!program["Reporter"] || String(program["Reporter"]).trim() === "");
            const manglerProducer = (!program["Producer"] || String(program["Producer"]).trim() === "");
            const manglerEkspert = (!program["Ekspert"] || String(program["Ekspert"]).trim() === "");

            const obUnitsArr = ["Minitech", "Nowtek OB1", "Nowtek OB2", "OB 7", "OB 9", "OB 7+9", "SAM OB", "OB"];
            const erOB = obUnitsArr.includes(unit);
            const unitLower = unit.toLowerCase();

            if (kanal === "Optagelse" && unit === "EFP") {
                if (manglerKommentator && manglerReporter) return true;
            } else if (kanal === "Optagelse" && unitLower.startsWith("studie")) {
                if (manglerProducer || manglerKommentator) return true;
            } else if (unit === "EFP" || kanal === "Optagelse") {
                if (manglerProducer || (manglerKommentator && manglerReporter)) return true;
            } else if (erOB) {
                if (manglerKommentator || manglerProducer || manglerEkspert) return true;
            } else {
                if (manglerKommentator) return true;
            }

            return false;
        }

        async function redigerProgram(rowId) {
            if (brugerRolle !== "Admin") {
                await visCustomDialog("Du har ikke tilladelse til at udføre denne handling.", "alert");
                return;
            }

            const program = alleProgrammerGlobal.find(p => p.RowId === rowId);
            if (!program) return;

            document.getElementById('RowId').value = program.RowId;
            
            if (program["NormDato"]) { document.getElementById('Dato').value = program["NormDato"]; } 
            else { document.getElementById('Dato').value = ""; }
            
            if (program["Tid"]) {
                const t = new Date(program["Tid"]);
                if (!isNaN(t.getTime()) && String(program["Tid"]).includes('T')) {
                    document.getElementById('Tid').value = String(t.getHours()).padStart(2, '0') + ":" + String(t.getMinutes()).padStart(2, '0');
                } else { document.getElementById('Tid').value = program["Tid"]; }
            } else { document.getElementById('Tid').value = ""; }

            if (program["TX"]) {
                const txDate = new Date(program["TX"]);
                if (!isNaN(txDate.getTime()) && String(program["TX"]).includes('T')) {
                    document.getElementById('TX').value = String(txDate.getHours()).padStart(2, '0') + ":" + String(txDate.getMinutes()).padStart(2, '0');
                } else { document.getElementById('TX').value = String(program["TX"]).substring(0, 5); }
            } else { document.getElementById('TX').value = ""; }

            document.getElementById('Kanal').value = program["Kanal"] || '';
            
            if (program["Kanal"] === 'Optagelse') {
                document.getElementById('group-Premieredato').style.display = 'flex';
                document.getElementById('Premieredato').value = program["Premieredato"] || '';
            } else {
                document.getElementById('group-Premieredato').style.display = 'none';
                document.getElementById('Premieredato').value = '';
            }

            document.getElementById('Sportsgren').value = program["Sportsgren"] || '';
            document.getElementById('Programtitel').value = program["Programtitel"] || '';
            document.getElementById('Lokation').value = program["Lokation"] || '';
            document.getElementById('Unit').value = program["Unit"] || '';
            document.getElementById('Format').value = program["Format"] || '';
            document.getElementById('RX').value = program["RX"] || '';
            document.getElementById('P-plan').value = program["P-plan"] || program["Produktionsplan"] || '';
            
            const gemtSignal = program["Signal til"] || program["Sling"] || '';
            const signalArray = gemtSignal.split(',').map(s => s.trim());
            document.querySelectorAll('#signalDropdown input[type="checkbox"]').forEach(cb => {
                cb.checked = signalArray.includes(cb.value);
            });
            updateSignalHeader();

            document.getElementById('Producer').value = program["Producer"] || '';
            document.getElementById('Kommentator').value = program["Kommentator"] || '';
            document.getElementById('Ekspert').value = program["Ekspert"] || '';
            document.getElementById('Reporter').value = program["Reporter"] || '';

            document.getElementById('Noter').value = program["Link / Noter"] || '';
            document.getElementById('TBC').checked = (program["TBC"] && String(program["TBC"]).toUpperCase() === 'X');

            document.getElementById('modalTitle').textContent = "Rediger program";
            document.getElementById('submitBtn').textContent = "Opdater program";

            formInitialState = hentFormularState();
            pendingTechInfoForNewProgram = null;
            openModal();
        }

        async function kopierProgram(rowId) {
            if (brugerRolle !== "Admin") {
                await visCustomDialog("Du har ikke tilladelse til at udføre denne handling.", "alert");
                return;
            }

            const program = alleProgrammerGlobal.find(p => p.RowId === rowId);
            if (!program) return;

            document.getElementById('RowId').value = "";
            
            if (program["NormDato"]) { document.getElementById('Dato').value = program["NormDato"]; } 
            else { document.getElementById('Dato').value = ""; }
            
            if (program["Tid"]) {
                const t = new Date(program["Tid"]);
                if (!isNaN(t.getTime()) && String(program["Tid"]).includes('T')) {
                    document.getElementById('Tid').value = String(t.getHours()).padStart(2, '0') + ":" + String(t.getMinutes()).padStart(2, '0');
                } else { document.getElementById('Tid').value = program["Tid"]; }
            } else { document.getElementById('Tid').value = ""; }

            if (program["TX"]) {
                const txDate = new Date(program["TX"]);
                if (!isNaN(txDate.getTime()) && String(program["TX"]).includes('T')) {
                    document.getElementById('TX').value = String(txDate.getHours()).padStart(2, '0') + ":" + String(txDate.getMinutes()).padStart(2, '0');
                } else { document.getElementById('TX').value = String(program["TX"]).substring(0, 5); }
            } else { document.getElementById('TX').value = ""; }

            document.getElementById('Kanal').value = program["Kanal"] || '';
            
            if (program["Kanal"] === 'Optagelse') {
                document.getElementById('group-Premieredato').style.display = 'flex';
                document.getElementById('Premieredato').value = program["Premieredato"] || '';
            } else {
                document.getElementById('group-Premieredato').style.display = 'none';
                document.getElementById('Premieredato').value = '';
            }

            document.getElementById('Sportsgren').value = program["Sportsgren"] || '';
            document.getElementById('Programtitel').value = program["Programtitel"] || '';
            document.getElementById('Lokation').value = program["Lokation"] || '';
            document.getElementById('Unit').value = program["Unit"] || '';
            document.getElementById('Format').value = program["Format"] || '';
            document.getElementById('RX').value = program["RX"] || '';
            document.getElementById('P-plan').value = program["P-plan"] || program["Produktionsplan"] || '';
            
            const gemtSignal = program["Signal til"] || program["Sling"] || '';
            const signalArray = gemtSignal.split(',').map(s => s.trim());
            document.querySelectorAll('#signalDropdown input[type="checkbox"]').forEach(cb => {
                cb.checked = signalArray.includes(cb.value);
            });
            updateSignalHeader();

            document.getElementById('Producer').value = program["Producer"] || '';
            document.getElementById('Kommentator').value = program["Kommentator"] || '';
            document.getElementById('Ekspert').value = program["Ekspert"] || '';
            document.getElementById('Reporter').value = program["Reporter"] || '';

            document.getElementById('Noter').value = program["Link / Noter"] || '';
            document.getElementById('TBC').checked = (program["TBC"] && String(program["TBC"]).toUpperCase() === 'X');

            pendingTechInfoForNewProgram = {
                "MAIN SRT IP": program["MAIN SRT IP"] || "",
                "MAIN SRT Port": program["MAIN SRT Port"] || "",
                "MAIN Passphrase": program["MAIN Passphrase"] || "",
                "MAIN Stream ID": program["MAIN Stream ID"] || "",
                "BACKUP SRT IP": program["BACKUP SRT IP"] || "",
                "BACKUP SRT Port": program["BACKUP SRT Port"] || "",
                "BACKUP Passphrase": program["BACKUP Passphrase"] || "",
                "BACKUP Stream ID": program["BACKUP Stream ID"] || "",
                "SRT Listener": program["SRT Listener"] || "",
                "SRT Listener IP": program["SRT Listener IP"] || "",
                "SRT Listener Port": program["SRT Listener Port"] || "",
                "SRT Listener Passphrase": program["SRT Listener Passphrase"] || "",
                "SRT Listener Stream ID": program["SRT Listener Stream ID"] || "",
                "BRT Listener": program["BRT Listener"] || "",
                "BRT Listener IP": program["BRT Listener IP"] || "",
                "BRT Listener Port": program["BRT Listener Port"] || "",
                "BRT Listener Passphrase": program["BRT Listener Passphrase"] || "",
                "BRT Listener Stream ID": program["BRT Listener Stream ID"] || "",
                "A1": program["A1"] || "",
                "A2": program["A2"] || "",
                "A3": program["A3"] || "",
                "A4": program["A4"] || "",
                "A5": program["A5"] || "",
                "A6": program["A6"] || "",
                "UTC start": program["UTC start"] || "",
                "UTC slut": program["UTC slut"] || "",
                "MCR telefon": program["MCR telefon"] || "",
                "MCR e-mail": program["MCR e-mail"] || "",
                "MCR titel": program["MCR titel"] || "",
                "Kontakt 1 telefon": program["Kontakt 1 telefon"] || "",
                "Kontakt 1 e-mail": program["Kontakt 1 e-mail"] || "",
                "Kontakt 1 titel": program["Kontakt 1 titel"] || "",
                "Kontakt 2 telefon": program["Kontakt 2 telefon"] || "",
                "Kontakt 2 e-mail": program["Kontakt 2 e-mail"] || "",
                "Kontakt 2 titel": program["Kontakt 2 titel"] || "",
                "Yderligere info": program["Yderligere info"] || ""
            };

            document.getElementById('modalTitle').textContent = "Kopier program";
            document.getElementById('submitBtn').textContent = "Gem program";

            formInitialState = hentFormularState();
            openModal();
        }

        async function bekraeftSlet(rowId) {
            if (brugerRolle !== "Admin") {
                await visCustomDialog("Du har ikke tilladelse til at udføre denne handling.", "alert");
                return;
            }

            const program = alleProgrammerGlobal.find(p => p.RowId === rowId);
            const titel = program ? program["Programtitel"] : "dette program";
            const bekræft = await visCustomDialog(`Er du sikker på, at du vil slette "${titel}"?\n\nDenne handling kan ikke fortrydes.`, "delete");
            if (bekræft) udfoerSletning(rowId);
        }

        async function udfoerSletning(rowId) {
            try {
                const rowBtn = document.querySelector(`button[onclick="redigerProgram(${rowId})"]`);
                if (rowBtn) {
                    const trMain = rowBtn.closest('.main-row');
                    if (trMain) {
                        trMain.style.opacity = '0.3';
                        if (trMain.nextElementSibling) trMain.nextElementSibling.style.opacity = '0.3';
                    }
                }

                await fetch(scriptURL, {
                    method: 'POST',
                    body: JSON.stringify({ action: "delete", RowId: rowId }),
                    headers: { 'Content-Type': 'text/plain;charset=utf-8' }
                });
                
                await loadProgrammer(true); 
            } catch (error) {
                console.error('Fejl ved sletning:', error);
                await visCustomDialog("Der skete en fejl under sletning. Prøv igen.", 'alert');
            }
        }

        function tegnTabel(programmer) {
            const table = document.getElementById('programTable');
            const ingenResultater = document.getElementById('ingenResultater');
            
            table.querySelectorAll('tbody').forEach(tb => tb.remove()); 

            if (programmer.length === 0) {
                table.style.display = 'none';
                ingenResultater.style.display = 'block';
                return;
            } else {
                table.style.display = 'table';
                ingenResultater.style.display = 'none';
            }

            const sysDato = new Date();
            const idagStr = sysDato.getFullYear() + "-" + String(sysDato.getMonth() + 1).padStart(2, '0') + "-" + String(sysDato.getDate()).padStart(2, '0');
            const dImorgen = new Date(sysDato);
            dImorgen.setDate(dImorgen.getDate() + 1);
            const imorgenStr = dImorgen.getFullYear() + "-" + String(dImorgen.getMonth() + 1).padStart(2, '0') + "-" + String(dImorgen.getDate()).padStart(2, '0');

            let forrigeDatoFormat = '';
            let isLightBg = true;

            programmer.forEach(program => {
                const normDato = program["NormDato"] || "";
                let pDatoFormat = normDato;
                
                if (normDato) {
                    const parts = normDato.split('-');
                    if(parts.length === 3) {
                        pDatoFormat = parts[2] + "/" + parts[1] + "/<span class='aarhundred'>" + parts[0].substring(0,2) + "</span>" + parts[0].substring(2,4);
                    }
                }
                
                const erIdag = (normDato === idagStr);
                const erImorgen = (normDato === imorgenStr);
                
                let datoSkift = false;
                if (forrigeDatoFormat !== '' && forrigeDatoFormat !== pDatoFormat) {
                    datoSkift = true;
                    isLightBg = !isLightBg;
                }
                forrigeDatoFormat = pDatoFormat;

                const pUgedag = program["Ugedag"] || '';
                let pTid = String(program["Tid"] || '-');
                let pTX = String(program["TX"] || '-');
                let pSted = program["Lokation"] && String(program["Lokation"]).trim() !== '' ? String(program["Lokation"]).trim() : '-';
                let kanalNavn = String(program["Kanal"] || '');
                
                let pKomm = program["Kommentator"] && String(program["Kommentator"]).trim() !== '' ? String(program["Kommentator"]).trim() : '';
                if (kanalNavn === 'Optagelse' && String(program["Unit"]) === 'EFP') {
                    if (pKomm === '' && program["Reporter"] && String(program["Reporter"]).trim() !== '') {
                        pKomm = String(program["Reporter"]).trim();
                    }
                }
                if (pKomm === '') pKomm = '-';
                
                if (pTid !== '-' && pTid.includes('T')) {
                    const t = new Date(pTid);
                    pTid = t.toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' });
                }
                
                if (pTX !== '-' && pTX.includes('T')) {
                    const tTX = new Date(pTX);
                    pTX = tTX.toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' });
                } else if (pTX !== '-') {
                    pTX = String(pTX).substring(0, 5);
                }

                let badgeBg = '';
                let badgeFg = 'white';
                let mobileColor = '';

                if (kanalNavn === 'Feltet+') { badgeBg = '#ff0d99'; mobileColor = '#ff0d99'; }
                else if (kanalNavn === 'Bold+') { badgeBg = '#92d050'; badgeFg = 'black'; mobileColor = '#92d050'; }
                else if (kanalNavn === 'Ekstra Bladet+') { badgeBg = '#ff0000'; mobileColor = '#ff0000'; }
                else if (kanalNavn === 'Pay-Per-View') { badgeBg = '#175b30'; mobileColor = '#175b30'; }
                else if (kanalNavn === 'Optagelse') { badgeBg = '#000000'; mobileColor = '#000000'; }
                else if (kanalNavn === 'Pluto TV (DK)') { badgeBg = '#7030a0'; mobileColor = '#7030a0'; }
                else if (kanalNavn === 'Pluto TV (NO)') { badgeBg = '#3b201f'; mobileColor = '#3b201f'; }
                else if (kanalNavn === 'Pluto TV (SE)') { badgeBg = '#3b62d3'; mobileColor = '#3b62d3'; }
                else if (kanalNavn === 'Pluto TV (DE)') { badgeBg = '#fff80c'; badgeFg = 'black'; mobileColor = '#d0b800'; } 
                else if (kanalNavn === 'SPORT LIVE') { badgeBg = '#dc5e11'; mobileColor = '#dc5e11'; }
                else { badgeBg = '#e9ecef'; badgeFg = '#000000'; mobileColor = '#000000'; } 

                let kanalKort = kanalNavn;
                if (kanalNavn === 'Ekstra Bladet+') kanalKort = 'Ekstra Bladet';
                else if (kanalNavn === 'Pluto TV (DK)') kanalKort = 'Pluto (DK)';
                else if (kanalNavn === 'Pluto TV (NO)') kanalKort = 'Pluto (NO)';
                else if (kanalNavn === 'Pluto TV (SE)') kanalKort = 'Pluto (SE)';
                else if (kanalNavn === 'Pluto TV (DE)') kanalKort = 'Pluto (DE)';

                let kanalDisplay = kanalNavn !== '' ? `<span class="kanal-badge" style="background-color: ${badgeBg}; color: ${badgeFg}; --mobile-color: ${mobileColor};"><span class="kanal-desktop">${kanalNavn}</span><span class="kanal-mobile" style="display:none;">${kanalKort}</span></span>` : '';

                let noterTekst = String(program["Link / Noter"] || '');
                let formateretNoter = noterTekst;
                if (noterTekst !== '') {
                    const urlRegex = /(https?:\/\/[^\s]+)/g;
                    formateretNoter = noterTekst.replace(urlRegex, url => `<a href="${url}" target="_blank" style="color: #0056b3; text-decoration: underline; word-break: break-all;">${url}</a>`);
                }

                if (String(program["Kanal"]) === 'Optagelse' && program["Premieredato"]) {
                    const premParts = String(program["Premieredato"]).split('-');
                    if (premParts.length === 3) {
                        const premDatoFormat = premParts[2] + "/" + premParts[1] + "/" + premParts[0];
                        const premTekst = `<span style="color: #000000; font-weight: 500;">Programsat første gang ${premDatoFormat}.</span>`;

                        if (formateretNoter === '-' || formateretNoter.trim() === '') {
                            formateretNoter = premTekst;
                        } else {
                            formateretNoter = `<div style="margin-bottom: 4px;">${premTekst}</div>` + formateretNoter;
                        }
                    }
                }

                let visProgramtitel = program["Programtitel"] ? String(program["Programtitel"]).trim() : '';
                if (program["TBC"] && String(program["TBC"]).toUpperCase() === 'X') {
                    visProgramtitel += ' <span style="color: red; font-weight: bold;">TBC</span>';
                }
                
                const pSportsgren = program["Sportsgren"] ? String(program["Sportsgren"]).toUpperCase() : '';
                let sportsgrenHtml = pSportsgren ? `<div style="margin-bottom: 8px; color: #dd5f12;">${pSportsgren}</div>` : '';

                let pPlanTekst = String(program["P-plan"] || program["Produktionsplan"] || '-');
                let signalTekst = String(program["Signal til"] || program["Sling"] || '-');
                let signalStyling = signalTekst !== '-' ? 'color: red; font-weight: bold;' : '';
                
                let pPlanDisplay = '-';
                if (pPlanTekst !== '-' && pPlanTekst.trim() !== '') {
                    let linkUrl = pPlanTekst.trim();
                    if (!linkUrl.startsWith('http://') && !linkUrl.startsWith('https://')) linkUrl = 'https://' + linkUrl;
                    pPlanDisplay = `<a href="${linkUrl}" target="_blank" style="color: #0056b3; font-weight: 500; text-decoration: none;">Klik her for at åbne</a>`;
                }

                let datoCelleStyle = '';
                let ugedagCelleStyle = '';
                if (erIdag) {
                    datoCelleStyle = 'background-color: #a3d9b1; color: black; font-weight: bold;';
                    ugedagCelleStyle = 'background-color: #a3d9b1; color: black; font-weight: bold;';
                } else if (erImorgen) {
                    datoCelleStyle = 'background-color: #ffe58f; color: black; font-weight: bold;';
                    ugedagCelleStyle = 'background-color: #ffe58f; color: black; font-weight: bold;';
                }

                let handlingsKnapper = `
                    <button class="toggle-btn" onclick="toggleDetails(this)">▼</button>
                    <button class="action-btn tech-btn" onclick="aabenTechModal(event, ${program.RowId})" title="Teknisk info"><svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;"><path d="M4 10a7.31 7.31 0 0 0 10 10Z"></path><path d="m9 15-1.5-1.5"></path><path d="M17 13a6 6 0 0 0-6-6"></path><path d="M21 9a10 10 0 0 0-10-10"></path></svg></button>
                    <button class="action-btn rediger-btn" onclick="redigerProgram(${program.RowId})" title="Rediger program">Rediger</button>
                    <button class="action-btn kopier-btn" onclick="kopierProgram(${program.RowId})" title="Kopier program">Kopier</button>
                    <button class="action-btn slet-btn" onclick="bekraeftSlet(${program.RowId})" title="Slet program">✖</button>
                `;

                const tbody = document.createElement('tbody');
                tbody.className = 'program-block ' + (isLightBg ? 'bg-light' : 'bg-dark');

                if (datoSkift) {
                    const trSep = document.createElement('tr');
                    trSep.className = 'date-separator-row'; 
                    trSep.innerHTML = `<td colspan="10" style="padding: 0; border: none;"><div style="height: 1px; background-color: rgba(0,0,0,0.3); width: 100%;"></div></td>`;
                    tbody.appendChild(trSep);
                }

                let visUnitRen = String(program["Unit"] || '');
                if (visUnitRen.toUpperCase() === "OB" || visUnitRen.toUpperCase() === "BOKS") {
                    visUnitRen = "";
                }
                
                let visUnitKolonne = visUnitRen;
                if (visUnitKolonne.toUpperCase() === "NOWTEK OB1" || visUnitKolonne.toUpperCase() === "NOWTEK OB2") {
                    visUnitKolonne = "NOWTEK";
                }
                
                let visUnitMedIkoner = visUnitKolonne;
                let hasAdvarsel = skalViseAdvarsel(program);
                let hasSignal = (signalTekst !== '-' && signalTekst.trim() !== '');

                if (hasAdvarsel || hasSignal) {
                    let ikoner = '';
                    if (hasAdvarsel) {
                        ikoner += `<span style="display: inline-flex; align-items: center; justify-content: center; background-color: #dc3545; color: white; width: 16px; height: 16px; border-radius: 50%; font-size: 12px; font-weight: bold; cursor: help; flex-shrink: 0;" title="Mangler bemanding!">!</span>`;
                    }
                    if (hasSignal) {
                        ikoner += `<span style="display: inline-flex; align-items: center; justify-content: center; background-color: #fdd932; color: black; width: 16px; height: 16px; border-radius: 50%; font-size: 12px; font-weight: bold; font-family: 'Times New Roman', Times, serif; font-style: italic; cursor: help; flex-shrink: 0;" title="Signal skal sendes til: ${signalTekst}">i</span>`;
                    }
                    visUnitMedIkoner = `<div style="display: flex; justify-content: space-between; align-items: center;"><span style="padding-right: 2px;">${visUnitKolonne}</span><div style="display: flex; gap: 3px; flex-shrink: 0;">${ikoner}</div></div>`;
                }

                let pFormat = program["Format"] ? String(program["Format"]).trim() : '';
                let pRX = program["RX"] ? String(program["RX"]).trim() : '';

                let utcDisplay = '-';
                if (pTid !== '-' && pTid.includes(':') && normDato !== '') {
                    const [timerStr, minutterStr] = pTid.split(':');
                    let timer = parseInt(timerStr, 10);
                    let minutter = parseInt(minutterStr, 10);
                    
                    if (!isNaN(timer) && !isNaN(minutter)) {
                        const tzTestDate = new Date(`${normDato}T12:00:00Z`);
                        const formatter = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Copenhagen', timeZoneName: 'short' });
                        const tzPart = formatter.formatToParts(tzTestDate).find(p => p.type === 'timeZoneName');
                        const isSummertime = tzPart && (tzPart.value.includes('+2') || tzPart.value.includes('CEST') || tzPart.value.includes('GMT+2'));
                        const offset = isSummertime ? 2 : 1;
                        
                        timer -= offset;
                        if (timer < 0) timer += 24;
                        
                        utcDisplay = "Kl. " + String(timer).padStart(2, '0') + ':' + String(minutter).padStart(2, '0');
                    }
                }

                const trMain = document.createElement('tr');
                trMain.className = 'main-row';
                trMain.onclick = function(e) { toggleDetailsFromRow(e, this); };
                
                trMain.innerHTML = `
                    <td style="${datoCelleStyle}">${pDatoFormat}</td>
                    <td style="${ugedagCelleStyle}">${pUgedag}</td>
                    <td><b>${pTid}</b></td>
                    <td><b>${pTX}</b></td>
                    <td>${kanalDisplay}</td>
                    <td><div class="mobile-sportsgren-wrapper">${program["Sportsgren"] || ''}</div></td>
                    <td><div class="prog-title-wrapper">${visProgramtitel}</div></td>
                    <td>${pKomm}</td>
                    <td>${visUnitMedIkoner}</td>
                    <td style="white-space: nowrap;">${handlingsKnapper}</td>
                `;
                
                const trDetail = document.createElement('tr');
                trDetail.className = 'detail-row';
                trDetail.innerHTML = `
                    <td colspan="10">
                        <div class="mobile-only-title">
                            ${sportsgrenHtml}
                            <div>${visProgramtitel}</div>
                        </div>
                        
                        <div class="detail-container">
                            <div class="detail-card bemanding">
                                <h4>Personale</h4>
                                <div class="detail-list">
                                    <div class="detail-list-item"><span class="detail-label">Producer:</span> <span class="detail-value">${program["Producer"] || '-'}</span></div>
                                    <div class="detail-list-item"><span class="detail-label">Kommentator/vært:</span> <span class="detail-value">${program["Kommentator"] || '-'}</span></div>
                                    <div class="detail-list-item"><span class="detail-label">Ekspert/gæst:</span> <span class="detail-value">${program["Ekspert"] || '-'}</span></div>
                                    <div class="detail-list-item"><span class="detail-label">Reporter:</span> <span class="detail-value">${program["Reporter"] || '-'}</span></div>
                                </div>
                            </div>
                            
                            <div class="detail-card teknik">
                                <h4>Tekniske specifikationer</h4>
                                <div class="detail-list">
                                    <div class="detail-list-item"><span class="detail-label">Unit:</span> <span class="detail-value">${visUnitRen || '-'}</span></div>
                                    <div class="detail-list-item"><span class="detail-label">Format:</span> <span class="detail-value">${pFormat || '-'}</span></div>
                                    <div class="detail-list-item"><span class="detail-label">RX:</span> <span class="detail-value">${pRX || '-'}</span></div>
                                    <div class="detail-list-item"><span class="detail-label">Signal skal sendes til:</span> <span class="detail-value" style="${signalStyling}">${signalTekst}</span></div>
                                </div>
                            </div>
                            
                            <div class="detail-card ekstra">
                                <h4>Ekstra information</h4>
                                <div class="detail-list">
                                    <div class="detail-list-item"><span class="detail-label">Lokation:</span> <span class="detail-value">${pSted}</span></div>
                                    <div class="detail-list-item"><span class="detail-label">Starttid UTC/GMT:</span> <span class="detail-value">${utcDisplay}</span></div>
                                    <div class="detail-list-item"><span class="detail-label">Produktionsplan:</span> <span class="detail-value">${pPlanDisplay}</span></div>
                                    <div class="detail-list-item"><span class="detail-label">Noter:</span> <span class="detail-value" style="color: #000000; text-align: right; max-width: 75%; word-break: break-word;">${formateretNoter}</span></div>
                                </div>
                            </div>
                        </div>
                    </td>
                `;

                tbody.appendChild(trMain);
                tbody.appendChild(trDetail);
                table.appendChild(tbody);
            });
        }

        async function gemProgram() {
            if (brugerRolle !== "Admin") {
                await visCustomDialog("Du har ikke tilladelse til at udføre denne handling.", "alert");
                return;
            }
            
            const valgtDato = document.getElementById('Dato').value;
            const valgtKanal = document.getElementById('Kanal').value;
            const valgtSportsgren = document.getElementById('Sportsgren').value;
            const valgtProgramtitel = document.getElementById('Programtitel').value;
            const valgtTid = document.getElementById('Tid').value;
            const valgtTX = document.getElementById('TX').value; 
            const valgtUnit = document.getElementById('Unit').value; 
            const rowId = document.getElementById('RowId').value;
            const valgtPremieredato = document.getElementById('Premieredato') ? document.getElementById('Premieredato').value : "";

            if (valgtTX && valgtTid) {
                if (valgtTX > valgtTid) {
                    await visCustomDialog("Transmission (TX) kan ikke begynde senere end starttidspunktet for begivenheden.", 'alert');
                    return;
                }
            }

            if (valgtKanal === "Optagelse" && valgtPremieredato && valgtDato) {
                if (valgtPremieredato < valgtDato) {
                    await visCustomDialog("Premieredato må ikke være tidligere end datoen for begivenheden.", 'alert');
                    return;
                }
            }

            if (!valgtDato || !valgtKanal || !valgtUnit || !valgtSportsgren || !valgtProgramtitel) {
                await visCustomDialog("Du skal som minimum vælge en dato, kanal, unit og sportsgren samt indtaste en programtitel.\n\nHvis du ikke kender den specifikke OB-enhed eller boks, skal du blot vælge \"OB\" eller \"BOKS\" fra listen.", 'alert');
                return; 
            }

            const felterTilValidering = [
                { id: 'Kanal', label: 'Kanal' },
                { id: 'Sportsgren', label: 'Sportsgren' },
                { id: 'Unit', label: 'Unit' },
                { id: 'Format', label: 'Format' },
                { id: 'RX', label: 'RX' }
            ];

            for (let felt of felterTilValidering) {
                const inputVal = document.getElementById(felt.id).value;
                if (inputVal) {
                    const datalist = document.getElementById('liste-' + felt.id);
                    if (datalist) {
                        const gyldigeValg = Array.from(datalist.options).map(opt => opt.value);
                        if (!gyldigeValg.includes(inputVal)) {
                            await visCustomDialog(`"${inputVal}" er ikke tilladt i feltet "${felt.label}". Vælg venligst en gyldig mulighed fra listen.`, 'alert');
                            return; 
                        }
                    }
                }
            }

            const sysDato = new Date();
            const idagsDatoStr = sysDato.getFullYear() + "-" + String(sysDato.getMonth() + 1).padStart(2, '0') + "-" + String(sysDato.getDate()).padStart(2, '0');

            if (valgtDato < idagsDatoStr) {
                const confirmPast = await visCustomDialog("Du er i gang med at tilføje et program på en dato, som ligger i fortiden. Vil du fortsætte?", 'confirm');
                if (!confirmPast) return; 
            }

            if (valgtKanal === "SPORT LIVE" && valgtDato && valgtTid) {
                const collision = alleProgrammerGlobal.find(p => {
                    if (rowId && String(p.RowId) === String(rowId)) return false;
                    if (p.Kanal !== "SPORT LIVE") return false;

                    const vTidFormatted = valgtTid.substring(0, 5);
                    let pTidFormatted = "";
                    if (p.Tid) {
                        const t = new Date(p.Tid);
                        if (!isNaN(t.getTime()) && String(p.Tid).includes('T')) {
                            pTidFormatted = String(t.getHours()).padStart(2, '0') + ":" + String(t.getMinutes()).padStart(2, '0');
                        } else {
                            pTidFormatted = String(p.Tid).substring(0, 5);
                        }
                    }

                    return (p.NormDato === valgtDato) && (pTidFormatted === vTidFormatted);
                });

                if (collision) {
                    const confirmCollision = await visCustomDialog(`Der ligger allerede et program på SPORT LIVE på denne dato og tidspunkt:\n\n"${collision.Programtitel}"\n\nVil du gemme programmet alligevel?`, 'confirm');
                    if (!confirmCollision) return; 
                }
            }

            const scrollContainer = document.querySelector('.table-container');
            const savedScrollPosition = scrollContainer ? scrollContainer.scrollTop : 0;
            
            const submitBtn = document.getElementById('submitBtn');
            const originalText = submitBtn.textContent;
            submitBtn.textContent = "Gemmer...";
            submitBtn.disabled = true;

            let beregnetUgedag = "";
            if (valgtDato) {
                const datoObjekt = new Date(valgtDato);
                const ugedage = ["S\u00f8ndag", "Mandag", "Tirsdag", "Onsdag", "Torsdag", "Fredag", "L\u00f8rdag"];
                beregnetUgedag = ugedage[datoObjekt.getDay()];
            }

            const tbcStatus = document.getElementById('TBC').checked ? "X" : "";
            const valgteSignaler = Array.from(document.querySelectorAll('#signalDropdown input[type="checkbox"]:checked')).map(cb => cb.value).join(', ');

            const nyProduktion = {
                "RowId": rowId, 
                "Dato": valgtDato,
                "Ugedag": beregnetUgedag,
                "Kanal": valgtKanal,
                "Premieredato": valgtPremieredato,
                "Sportsgren": valgtSportsgren,
                "Programtitel": valgtProgramtitel,
                "Lokation": document.getElementById('Lokation').value,
                "Tid": valgtTid,
                "Unit": document.getElementById('Unit').value,
                "Format": document.getElementById('Format').value,
                "RX": document.getElementById('RX').value,
                "P-plan": document.getElementById('P-plan').value,
                "Sling": valgteSignaler, 
                "Signal til": valgteSignaler, 
                "Producer": document.getElementById('Producer').value,
                "Kommentator": document.getElementById('Kommentator').value,
                "Ekspert": document.getElementById('Ekspert').value,
                "Reporter": document.getElementById('Reporter').value,
                "Teknisk info": "", 
                "Link / Noter": document.getElementById('Noter').value,
                "TBC": tbcStatus,
                "TX": valgtTX 
            };

            if (!rowId && pendingTechInfoForNewProgram) {
                Object.assign(nyProduktion, pendingTechInfoForNewProgram);
            }

            try {
                await fetch(scriptURL, {
                    method: 'POST',
                    body: JSON.stringify(nyProduktion),
                    headers: { 'Content-Type': 'text/plain;charset=utf-8' }
                });
                
                closeModal();
                document.getElementById('programForm').reset();
                pendingTechInfoForNewProgram = null; 
                
                await loadProgrammer(true); 
                
                if (scrollContainer) {
                    scrollContainer.scrollTop = savedScrollPosition;
                }
                
            } catch (error) {
                console.error('Fejl ved gemning:', error);
                await visCustomDialog("Der skete en fejl. Prøv igen.", 'alert');
            } finally {
                submitBtn.textContent = originalText;
                submitBtn.disabled = false;
            }
        }

        window.onload = function() {
            const yearContainer = document.getElementById('yearFilterContainer');
            const aktueltAar = new Date().getFullYear();
            
            for (let i = -1; i <= 2; i++) {
                let a = aktueltAar + i;
                yearContainer.innerHTML += `<span class="year-option" id="year-${a}" onclick="filtrerAar(${a})">${a}</span>`;
            }

            const gemtBruger = localStorage.getItem('sportlive_user');
            const gemtRolle = localStorage.getItem('sportlive_role');
            const gemtNavn = localStorage.getItem('sportlive_navn');
            const gemtPassLen = localStorage.getItem('sportlive_passlen');
            const gemtNotif = localStorage.getItem('sportlive_notif'); 
            
            if (gemtBruger && gemtRolle) {
                aktuelBruger = gemtBruger;
                brugerRolle = gemtRolle;
                aktueltNavn = gemtNavn || gemtBruger;
                aktuelPassLen = gemtPassLen || 8;
                aktuelNotifikation = (gemtNotif === "true"); 
                afslutLogin();
            } else {
                document.getElementById('loginOverlay').style.display = 'flex';
                document.getElementById('loginUsername').focus();
            }

            setInterval(() => {
                if (brugerRolle !== "") {
                    let erForstyrret = false;
                    
                    document.querySelectorAll('.detail-row').forEach(row => {
                        if (row.style.display === 'table-row') erForstyrret = true;
                    });
                    
                    if (document.getElementById('programModal').style.display === 'block') erForstyrret = true;
                    if (document.getElementById('profileModal').style.display === 'flex') erForstyrret = true;
                    if (document.getElementById('customDialog').style.display === 'flex') erForstyrret = true;
                    
                    const techM = document.getElementById('techModal');
                    if (techM && techM.style.display === 'block') erForstyrret = true;

                    if (!erForstyrret) {
                        loadProgrammer(true);
                    }
                }
            }, 600000);
            
            document.getElementById('Kanal').addEventListener('input', function() {
                if (this.value === 'Optagelse') {
                    document.getElementById('group-Premieredato').style.display = 'flex';
                } else {
                    document.getElementById('group-Premieredato').style.display = 'none';
                }
            });
            
        };

        var modal = document.getElementById("programModal");
        var profilModal = document.getElementById("profileModal");
        
        function openModal() { modal.style.display = "block"; }
        function closeModal() { modal.style.display = "none"; }
        
        let touchstartX = 0;
        let touchendX = 0;

        const tableContainerEl = document.querySelector('.table-container');
        
        if (tableContainerEl) {
            tableContainerEl.addEventListener('touchstart', e => {
                touchstartX = e.changedTouches[0].screenX;
            }, {passive: true});

            tableContainerEl.addEventListener('touchend', e => {
                touchendX = e.changedTouches[0].screenX;
                handterMobileSwipe();
            }, {passive: true});
        }

        function handterMobileSwipe() {
            if (window.innerWidth <= 900) {
                if (touchendX > touchstartX + 60) {
                    document.body.classList.add('show-mobile-weekday');
                } 
                else if (touchendX < touchstartX - 60) {
                    document.body.classList.remove('show-mobile-weekday');
                }
            }
        }