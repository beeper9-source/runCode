// 페이지 로드 시 미션 목록 로드
document.addEventListener('DOMContentLoaded', loadMissionList);

// 미션 목록 로드
async function loadMissionList() {
    try {
        const { data: missions, error } = await supabase
            .from('rc_weekly_mission')
            .select('mission_id, title, year, week_number, start_date, end_date')
            .order('year', { ascending: false })
            .order('week_number', { ascending: false });

        if (error) throw error;

        const select = document.getElementById('performanceMissionSelect');
        select.innerHTML = '<option value="">미션을 선택하세요</option>' +
            missions.map(m => 
                `<option value="${m.mission_id}" data-start="${m.start_date}" data-end="${m.end_date}">
                    ${m.year}년 ${m.week_number}주차 - ${m.title}
                </option>`
            ).join('');

        document.getElementById('performanceContainer').style.display = 'none';
    } catch (error) {
        console.error('미션 목록 로드 오류:', error);
        showAlert('미션 목록을 불러오는 중 오류가 발생했습니다.', 'error');
    }
}

// 실적 데이터 로드
async function loadPerformanceData() {
    const missionId = document.getElementById('performanceMissionSelect').value;
    
    if (!missionId) {
        document.getElementById('performanceContainer').style.display = 'none';
        document.getElementById('performanceFilters').style.display = 'none';
        return;
    }

    try {
        // 미션 정보 가져오기
        const select = document.getElementById('performanceMissionSelect');
        const selectedOption = select.options[select.selectedIndex];
        const startDate = selectedOption.getAttribute('data-start');
        const endDate = selectedOption.getAttribute('data-end');

        // 회원 목록 가져오기
        const { data: members, error: membersError } = await supabase
            .from('rc_member')
            .select('member_id, name, team')
            .order('team')
            .order('name');

        if (membersError) throw membersError;

        // 기존 기록 가져오기
        const { data: records, error: recordsError } = await supabase
            .from('rc_running_record')
            .select('record_id, member_id, running_date, distance')
            .gte('running_date', startDate)
            .lte('running_date', endDate);

        if (recordsError) throw recordsError;

        // 요일별 날짜 계산 (목요일부터 수요일)
        const dates = getWeekDates(startDate, endDate);
        
        // 테이블 헤더 생성
        const thead = document.getElementById('performanceHeader');
        const headerRow = thead.querySelector('tr');
        
        // 기존 요일 헤더 제거 (조, 회원명, 완료 제외)
        const existingHeaders = Array.from(headerRow.querySelectorAll('th'));
        existingHeaders.forEach((th, index) => {
            // 첫 번째(조), 두 번째(회원명), 마지막(완료)은 유지
            if (index > 1 && index < existingHeaders.length - 1) {
                th.remove();
            }
        });
        
        // 요일별 헤더 추가
        dates.forEach(dateInfo => {
            const th = document.createElement('th');
            th.className = 'day-header';
            th.innerHTML = dateInfo.fullDisplay;
            th.style.textAlign = 'center';
            headerRow.insertBefore(th, headerRow.lastElementChild);
        });
        
        // records를 전역 변수로 저장 (저장 시 사용)
        window.currentPerformanceRecords = records;
        window.currentPerformanceMembers = members;

        // 회원 필터 드롭다운 채우기
        populateMemberFilter(members);
        document.getElementById('performanceFilters').style.display = 'block';

        // 테이블 생성
        buildPerformanceTable(members, records, dates);

        document.getElementById('performanceContainer').style.display = 'block';
    } catch (error) {
        console.error('실적 데이터 로드 오류:', error);
        showAlert('실적 데이터를 불러오는 중 오류가 발생했습니다.', 'error');
    }
}

// 실적 테이블 필터링
function filterPerformanceTable() {
    const teamFilter = document.getElementById('performanceTeamFilter').value;
    const memberFilter = document.getElementById('performanceMemberFilter').value;

    // 회원 필터 드롭다운 업데이트
    if (window.currentPerformanceMembers) {
        populateMemberFilter(window.currentPerformanceMembers);
        // 회원 필터 값 복원
        if (memberFilter) {
            document.getElementById('performanceMemberFilter').value = memberFilter;
        }
    }

    // 테이블 다시 생성
    if (window.currentPerformanceMembers && window.currentPerformanceRecords) {
        const select = document.getElementById('performanceMissionSelect');
        const selectedOption = select.options[select.selectedIndex];
        const startDate = selectedOption.getAttribute('data-start');
        const endDate = selectedOption.getAttribute('data-end');
        const dates = getWeekDates(startDate, endDate);
        
        buildPerformanceTable(window.currentPerformanceMembers, window.currentPerformanceRecords, dates);
    }
}

// 회원 필터 드롭다운 채우기
function populateMemberFilter(members) {
    const select = document.getElementById('performanceMemberFilter');
    const teamFilter = document.getElementById('performanceTeamFilter').value;
    
    // 조별로 필터링
    const filteredMembers = teamFilter 
        ? members.filter(m => m.team === teamFilter)
        : members;
    
    select.innerHTML = '<option value="">전체 회원</option>' +
        filteredMembers.map(m => 
            `<option value="${m.member_id}">${m.name}</option>`
        ).join('');
}

// 테이블 생성 함수
function buildPerformanceTable(members, records, dates) {
    const tbody = document.getElementById('performanceBody');
    tbody.innerHTML = '';

    const teamFilter = document.getElementById('performanceTeamFilter').value;
    const memberFilter = document.getElementById('performanceMemberFilter').value;

    // 필터링된 회원 목록
    let filteredMembers = members;
    if (teamFilter) {
        filteredMembers = filteredMembers.filter(m => m.team === teamFilter);
    }
    if (memberFilter) {
        filteredMembers = filteredMembers.filter(m => m.member_id === parseInt(memberFilter));
    }

    filteredMembers.forEach(member => {
        const row = document.createElement('tr');
        
        // 조
        const teamCell = document.createElement('td');
        teamCell.textContent = `${member.team}조`;
        teamCell.className = 'team-header';
        row.appendChild(teamCell);

        // 회원명
        const nameCell = document.createElement('td');
        nameCell.textContent = member.name;
        nameCell.className = 'team-header';
        row.appendChild(nameCell);

        let completedCount = 0;

        // 요일별 입력 셀
        dates.forEach((dateInfo, index) => {
            const cell = document.createElement('td');
            cell.style.textAlign = 'center';
            const record = records.find(r => 
                r.member_id === member.member_id && 
                r.running_date === dateInfo.date
            );
            
            const hasRecord = record && parseFloat(record.distance) > 0;
            if (hasRecord) completedCount++;
            
            // O/X 선택 버튼 컨테이너
            const buttonContainer = document.createElement('div');
            buttonContainer.style.display = 'flex';
            buttonContainer.style.gap = '5px';
            buttonContainer.style.justifyContent = 'center';
            
            // O 버튼
            const oButton = document.createElement('button');
            oButton.type = 'button';
            oButton.textContent = 'O';
            oButton.style.width = '40px';
            oButton.style.height = '40px';
            oButton.style.border = '2px solid #4CAF50';
            oButton.style.borderRadius = '4px';
            oButton.style.backgroundColor = hasRecord ? '#4CAF50' : 'white';
            oButton.style.color = hasRecord ? 'white' : '#4CAF50';
            oButton.style.cursor = 'pointer';
            oButton.style.fontSize = '18px';
            oButton.style.fontWeight = 'bold';
            oButton.dataset.memberId = member.member_id;
            oButton.dataset.date = dateInfo.date;
            oButton.dataset.recordId = record ? record.record_id : '';
            oButton.dataset.type = 'O';
            
            // X 버튼
            const xButton = document.createElement('button');
            xButton.type = 'button';
            xButton.textContent = 'X';
            xButton.style.width = '40px';
            xButton.style.height = '40px';
            xButton.style.border = '2px solid #f44336';
            xButton.style.borderRadius = '4px';
            xButton.style.backgroundColor = !hasRecord ? '#f44336' : 'white';
            xButton.style.color = !hasRecord ? 'white' : '#f44336';
            xButton.style.cursor = 'pointer';
            xButton.style.fontSize = '18px';
            xButton.style.fontWeight = 'bold';
            xButton.dataset.memberId = member.member_id;
            xButton.dataset.date = dateInfo.date;
            xButton.dataset.recordId = record ? record.record_id : '';
            xButton.dataset.type = 'X';
            
            // 버튼 클릭 이벤트
            const handleClick = (clickedButton, isO) => {
                // 모든 버튼 초기화
                oButton.style.backgroundColor = 'white';
                oButton.style.color = '#4CAF50';
                xButton.style.backgroundColor = 'white';
                xButton.style.color = '#f44336';
                
                // 클릭한 버튼 활성화
                if (isO) {
                    oButton.style.backgroundColor = '#4CAF50';
                    oButton.style.color = 'white';
                    clickedButton.dataset.selected = 'true';
                    xButton.dataset.selected = 'false';
                } else {
                    xButton.style.backgroundColor = '#f44336';
                    xButton.style.color = 'white';
                    clickedButton.dataset.selected = 'true';
                    oButton.dataset.selected = 'false';
                }
                
                updateRowTotal(row);
            };
            
            oButton.onclick = () => handleClick(oButton, true);
            xButton.onclick = () => handleClick(xButton, false);
            
            // 초기 상태 설정
            if (hasRecord) {
                oButton.dataset.selected = 'true';
                xButton.dataset.selected = 'false';
            } else {
                oButton.dataset.selected = 'false';
                xButton.dataset.selected = 'true';
            }
            
            buttonContainer.appendChild(oButton);
            buttonContainer.appendChild(xButton);
            cell.appendChild(buttonContainer);
            row.appendChild(cell);
        });

        // 완료 개수
        const totalCell = document.createElement('td');
        totalCell.className = 'team-header';
        totalCell.textContent = `${completedCount}일`;
        totalCell.id = `total-${member.member_id}`;
        row.appendChild(totalCell);

        tbody.appendChild(row);
    });
}

// 주간 날짜 계산 (목요일부터 수요일)
function getWeekDates(startDate, endDate) {
    const dates = [];
    // 로컬 시간대 기준으로 날짜 파싱 (YYYY-MM-DD 형식)
    const [year, month, day] = startDate.split('-').map(Number);
    const start = new Date(year, month - 1, day);
    const [endYear, endMonth, endDay] = endDate.split('-').map(Number);
    const end = new Date(endYear, endMonth - 1, endDay);
    
    // 시작일이 목요일이 되도록 조정 (목요일 = 4)
    const startDay = start.getDay(); // 0=일, 1=월, ..., 4=목, 5=금, 6=토
    let daysToThursday = 0;
    
    if (startDay === 0) { // 일요일
        daysToThursday = 4;
    } else if (startDay <= 4) { // 월~목
        daysToThursday = 4 - startDay;
    } else { // 금~토
        daysToThursday = 4 - startDay + 7;
    }
    
    const thursday = new Date(start);
    thursday.setDate(start.getDate() + daysToThursday);
    
    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
    
    // 목요일부터 수요일까지 7일
    for (let i = 0; i < 7; i++) {
        const date = new Date(thursday);
        date.setDate(thursday.getDate() + i);
        
        // 날짜를 YYYY-MM-DD 형식으로 변환
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${day}`;
        
        // startDate와 endDate 범위 내에 있는지 확인
        if (dateStr >= startDate && dateStr <= endDate) {
            const dayName = dayNames[date.getDay()];
            const displayMonth = date.getMonth() + 1;
            const displayDay = date.getDate();
            dates.push({
                date: dateStr,
                dayName: dayName,
                displayDate: `${displayMonth}/${displayDay}`,
                fullDisplay: `${dayName}<br>${displayMonth}/${displayDay}`
            });
        }
    }
    
    return dates;
}

// 행 합계 업데이트
function updateRowTotal(row) {
    const buttons = row.querySelectorAll('button[data-type="O"]');
    let completedCount = 0;
    
    buttons.forEach(button => {
        if (button.dataset.selected === 'true') {
            completedCount++;
        }
    });
    
    const totalCell = row.querySelector('td:last-child');
    if (totalCell) {
        totalCell.textContent = `${completedCount}일`;
    }
}

// 실적 저장
async function savePerformance() {
    const missionId = document.getElementById('performanceMissionSelect').value;
    
    if (!missionId) {
        showAlert('미션을 선택해주세요.', 'error');
        return;
    }

    try {
        const oButtons = document.querySelectorAll('#performanceBody button[data-type="O"]');
        const recordsToInsert = [];
        const recordsToUpdate = [];
        const recordsToDelete = [];

        oButtons.forEach(button => {
            const memberId = parseInt(button.dataset.memberId);
            const date = button.dataset.date;
            const recordId = button.dataset.recordId;
            const isSelected = button.dataset.selected === 'true';

            if (isSelected) {
                // O 선택 시 기록 추가/유지
                if (recordId) {
                    // 기존 기록이 있으면 유지 (거리 1km로 설정)
                    const existingRecord = recordsToUpdate.find(r => r.record_id === parseInt(recordId));
                    if (!existingRecord) {
                        recordsToUpdate.push({
                            record_id: parseInt(recordId),
                            distance: 1.0
                        });
                    }
                } else {
                    // 새 기록 추가
                    recordsToInsert.push({
                        member_id: memberId,
                        running_date: date,
                        distance: 1.0,
                        running_time: '00:30:00' // 기본값
                    });
                }
            } else if (recordId) {
                // X 선택 시 기록 삭제
                recordsToDelete.push(parseInt(recordId));
            }
        });

        // 삭제
        if (recordsToDelete.length > 0) {
            const { error } = await supabase
                .from('rc_running_record')
                .delete()
                .in('record_id', recordsToDelete);
            
            if (error) throw error;
        }

        // 업데이트
        for (const record of recordsToUpdate) {
            const { error } = await supabase
                .from('rc_running_record')
                .update({ distance: record.distance })
                .eq('record_id', record.record_id);
            
            if (error) throw error;
        }

        // 삽입
        if (recordsToInsert.length > 0) {
            const { error } = await supabase
                .from('rc_running_record')
                .insert(recordsToInsert);
            
            if (error) throw error;
        }

        showAlert('실적이 저장되었습니다.', 'success');
        // 데이터 다시 로드
        loadPerformanceData();
    } catch (error) {
        console.error('실적 저장 오류:', error);
        showAlert('실적 저장 중 오류가 발생했습니다: ' + error.message, 'error');
    }
}

// 알림 표시
function showAlert(message, type = 'info') {
    const alertContainer = document.getElementById('alertContainer');
    const alertClass = `alert-${type === 'error' ? 'error' : type === 'success' ? 'success' : 'info'}`;
    
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert ${alertClass}`;
    alertDiv.textContent = message;
    
    alertContainer.innerHTML = '';
    alertContainer.appendChild(alertDiv);

    setTimeout(() => {
        alertDiv.remove();
    }, 3000);
}

