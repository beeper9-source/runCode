let currentEditId = null;
const teams = ['A', 'B', 'C', 'D', 'E', 'F'];
const daysOfWeek = ['목', '금', '토', '일', '월', '화', '수'];

// 미션 목록 로드
async function loadMissions() {
    try {
        const yearFilter = document.getElementById('yearFilter').value;
        const activeFilter = document.getElementById('activeFilter').value;

        let query = supabase
            .from('rc_weekly_mission')
            .select('*')
            .order('year', { ascending: false })
            .order('week_number', { ascending: false });

        if (yearFilter) {
            query = query.eq('year', parseInt(yearFilter));
        }

        if (activeFilter !== '') {
            query = query.eq('is_active', activeFilter === 'true');
        }

        const { data: missions, error } = await query;

        if (error) throw error;

        displayMissions(missions);
        populateYearFilter(missions);
    } catch (error) {
        console.error('미션 목록 로드 오류:', error);
        showAlert('미션 목록을 불러오는 중 오류가 발생했습니다.', 'error');
    }
}

// 연도 필터 채우기
function populateYearFilter(missions) {
    const years = [...new Set(missions.map(m => m.year))].sort((a, b) => b - a);
    const select = document.getElementById('yearFilter');
    const currentValue = select.value;
    
    select.innerHTML = '<option value="">전체 연도</option>' + 
        years.map(year => `<option value="${year}">${year}년</option>`).join('');
    
    if (currentValue) {
        select.value = currentValue;
    }
}

// 미션 표시
function displayMissions(missions) {
    const container = document.getElementById('missionsList');
    
    if (!missions || missions.length === 0) {
        container.innerHTML = '<div class="empty-state">등록된 미션이 없습니다.</div>';
        return;
    }

    container.innerHTML = missions.map(mission => {
        const startDate = new Date(mission.start_date).toLocaleDateString('ko-KR');
        const endDate = new Date(mission.end_date).toLocaleDateString('ko-KR');
        const isActive = mission.is_active;
        
        return `
            <div class="mission-card" onclick="showMissionDetail(${mission.mission_id})">
                <h3>${mission.title} ${isActive ? '<span class="badge badge-success">활성</span>' : '<span class="badge badge-warning">비활성</span>'}</h3>
                <div class="meta">
                    <span>${mission.year}년 ${mission.week_number}주차</span>
                    <span>${startDate} ~ ${endDate}</span>
                </div>
                ${mission.description ? `<p style="color: #666; margin-top: 10px;">${mission.description}</p>` : ''}
                <div style="margin-top: 15px; display: flex; gap: 10px;">
                    <button class="btn btn-small btn-primary" onclick="event.stopPropagation(); editMission(${mission.mission_id})">수정</button>
                    <button class="btn btn-small btn-danger" onclick="event.stopPropagation(); deleteMission(${mission.mission_id})">삭제</button>
                </div>
            </div>
        `;
    }).join('');
}

// 미션 상세 보기
async function showMissionDetail(missionId) {
    try {
        const { data: mission, error } = await supabase
            .from('rc_weekly_mission')
            .select('*')
            .eq('mission_id', missionId)
            .single();

        if (error) throw error;

        // 미션 상세 정보 가져오기
        const { data: details, error: detailsError } = await supabase
            .from('rc_mission_detail')
            .select('*')
            .eq('mission_id', missionId)
            .order('team')
            .order('day_of_week');

        if (detailsError) throw detailsError;

        // 진행률 계산
        const progress = await calculateMissionProgress(missionId, mission, details);

        const startDate = new Date(mission.start_date).toLocaleDateString('ko-KR');
        const endDate = new Date(mission.end_date).toLocaleDateString('ko-KR');

        let content = `
            <div>
                <h3 style="margin-bottom: 15px;">${mission.title}</h3>
                <div style="margin-bottom: 20px; color: #666;">
                    <p><strong>년도/주차:</strong> ${mission.year}년 ${mission.week_number}주차</p>
                    <p><strong>기간:</strong> ${startDate} ~ ${endDate}</p>
                    <p><strong>상태:</strong> ${mission.is_active ? '<span class="badge badge-success">활성</span>' : '<span class="badge badge-warning">비활성</span>'}</p>
                    ${mission.description ? `<p style="margin-top: 15px;"><strong>설명:</strong><br>${mission.description}</p>` : ''}
                </div>

                <div style="margin-top: 30px;">
                    <h4 style="margin-bottom: 20px;">조별 요일별 미션</h4>
                    <div style="overflow-x: auto;">
                        <table class="mission-table">
                            <thead>
                                <tr>
                                    <th class="team-header">조</th>
                                    ${daysOfWeek.map(day => `<th class="day-header">${day}</th>`).join('')}
                                </tr>
                            </thead>
                            <tbody>
        `;

        // 조별로 미션 표시
        teams.forEach(team => {
            content += `<tr><td class="team-header">${team}조</td>`;
            daysOfWeek.forEach(day => {
                const detail = details.find(d => d.team === team && d.day_of_week === day);
                if (detail) {
                    content += `<td>
                        ${detail.mission_content ? `<strong>${detail.mission_content}</strong><br>` : ''}
                        ${detail.target_distance ? `목표: ${parseFloat(detail.target_distance).toFixed(1)} km` : ''}
                    </td>`;
                } else {
                    content += `<td>-</td>`;
                }
            });
            content += `</tr>`;
        });

        content += `
                            </tbody>
                        </table>
                    </div>
                </div>

                <div class="team-progress" style="margin-top: 30px;">
                    <h4 style="margin-bottom: 20px;">조별 진행 현황</h4>
        `;

        // 조별 진행률 표시
        progress.forEach(teamProgress => {
            const achievementRate = teamProgress.achievement_rate || 0;
            const progressWidth = Math.min(achievementRate, 200);
            
            content += `
                <div class="team-progress-item">
                    <h4>${teamProgress.team}조</h4>
                    <p>총 거리: ${teamProgress.total_distance.toFixed(1)} km</p>
                    <p>회원 수: ${teamProgress.member_count}명</p>
                    <p>평균 거리: ${teamProgress.average_distance.toFixed(1)} km</p>
                    <p>달성률: ${achievementRate.toFixed(1)}%</p>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${progressWidth}%;">
                            ${achievementRate.toFixed(1)}%
                        </div>
                    </div>
                </div>
            `;
        });

        content += `
                </div>
            </div>
        `;

        document.getElementById('detailModalTitle').textContent = mission.title;
        document.getElementById('missionDetailContent').innerHTML = content;
        document.getElementById('missionDetailModal').classList.add('active');
    } catch (error) {
        console.error('미션 상세 로드 오류:', error);
        showAlert('미션 상세 정보를 불러오는 중 오류가 발생했습니다.', 'error');
    }
}

// 미션 진행률 계산
async function calculateMissionProgress(missionId, mission, details) {
    try {
        const progress = [];

        for (const team of teams) {
            // 조별 회원 가져오기
            const { data: members, error: membersError } = await supabase
                .from('rc_member')
                .select('member_id')
                .eq('team', team);

            if (membersError) throw membersError;

            const memberIds = members.map(m => m.member_id);
            
            if (memberIds.length === 0) {
                progress.push({
                    team: team,
                    total_distance: 0,
                    member_count: 0,
                    average_distance: 0,
                    achievement_rate: 0
                });
                continue;
            }

            // 기간 내 런닝 기록 가져오기
            const { data: records, error: recordsError } = await supabase
                .from('rc_running_record')
                .select('distance, running_date')
                .in('member_id', memberIds)
                .gte('running_date', mission.start_date)
                .lte('running_date', mission.end_date);

            if (recordsError) throw recordsError;

            const totalDistance = records.reduce((sum, r) => sum + parseFloat(r.distance || 0), 0);
            const memberCount = memberIds.length;
            const averageDistance = memberCount > 0 ? totalDistance / memberCount : 0;

            // 조별 목표 거리 계산 (요일별 목표 거리 합계)
            const teamDetails = details.filter(d => d.team === team);
            const totalTargetDistance = teamDetails.reduce((sum, d) => sum + parseFloat(d.target_distance || 0), 0);
            
            const achievementRate = totalTargetDistance > 0
                ? (averageDistance / totalTargetDistance) * 100
                : 0;

            progress.push({
                team: team,
                total_distance: totalDistance,
                member_count: memberCount,
                average_distance: averageDistance,
                achievement_rate: achievementRate
            });
        }

        // 달성률 기준으로 정렬
        progress.sort((a, b) => b.achievement_rate - a.achievement_rate);

        return progress;
    } catch (error) {
        console.error('진행률 계산 오류:', error);
        return [];
    }
}

// 미션 등록 모달 열기
function openMissionModal(missionId = null) {
    currentEditId = missionId;
    const modal = document.getElementById('missionModal');
    const form = document.getElementById('missionForm');
    const title = document.getElementById('modalTitle');

    if (missionId) {
        title.textContent = '미션 수정';
        loadMissionData(missionId);
    } else {
        title.textContent = '미션 등록';
        form.reset();
        document.getElementById('missionId').value = '';
        document.getElementById('year').value = new Date().getFullYear();
        document.getElementById('isActive').checked = true;
        buildMissionDetailTable();
    }

    modal.classList.add('active');
}

// 미션 상세 테이블 생성
function buildMissionDetailTable() {
    const tbody = document.getElementById('missionDetailBody');
    tbody.innerHTML = '';

    teams.forEach(team => {
        const row = document.createElement('tr');
        const teamCell = document.createElement('td');
        teamCell.className = 'team-header';
        teamCell.textContent = `${team}조`;
        row.appendChild(teamCell);

        daysOfWeek.forEach(day => {
            const cell = document.createElement('td');
            cell.innerHTML = `
                <input type="text" 
                       placeholder="미션 내용" 
                       data-team="${team}" 
                       data-day="${day}" 
                       class="mission-content"
                       style="width: 100%; margin-bottom: 5px;">
                <input type="number" 
                       step="0.1" 
                       min="0" 
                       placeholder="목표 거리(km)" 
                       data-team="${team}" 
                       data-day="${day}" 
                       class="mission-distance"
                       style="width: 100%;">
            `;
            row.appendChild(cell);
        });

        tbody.appendChild(row);
    });
}

// 미션 데이터 로드 (수정용)
async function loadMissionData(missionId) {
    try {
        const { data: mission, error } = await supabase
            .from('rc_weekly_mission')
            .select('*')
            .eq('mission_id', missionId)
            .single();

        if (error) throw error;

        // 미션 상세 정보 가져오기
        const { data: details, error: detailsError } = await supabase
            .from('rc_mission_detail')
            .select('*')
            .eq('mission_id', missionId);

        if (detailsError) throw detailsError;

        // 기본 정보 설정
        document.getElementById('missionId').value = mission.mission_id;
        document.getElementById('year').value = mission.year;
        document.getElementById('weekNumber').value = mission.week_number;
        document.getElementById('title').value = mission.title;
        document.getElementById('description').value = mission.description || '';
        document.getElementById('startDate').value = mission.start_date;
        document.getElementById('endDate').value = mission.end_date;
        document.getElementById('isActive').checked = mission.is_active;

        // 미션 상세 테이블 생성 및 데이터 채우기
        buildMissionDetailTable();

        // 상세 정보 채우기
        details.forEach(detail => {
            const contentInput = document.querySelector(
                `.mission-content[data-team="${detail.team}"][data-day="${detail.day_of_week}"]`
            );
            const distanceInput = document.querySelector(
                `.mission-distance[data-team="${detail.team}"][data-day="${detail.day_of_week}"]`
            );

            if (contentInput) {
                contentInput.value = detail.mission_content || '';
            }
            if (distanceInput) {
                distanceInput.value = detail.target_distance || '';
            }
        });
    } catch (error) {
        console.error('미션 데이터 로드 오류:', error);
        showAlert('미션 정보를 불러오는 중 오류가 발생했습니다.', 'error');
    }
}

// 미션 수정
function editMission(missionId) {
    openMissionModal(missionId);
}

// 미션 저장
async function saveMission(event) {
    event.preventDefault();

    try {
        const missionId = document.getElementById('missionId').value;
        const missionData = {
            year: parseInt(document.getElementById('year').value),
            week_number: parseInt(document.getElementById('weekNumber').value),
            title: document.getElementById('title').value,
            description: document.getElementById('description').value || null,
            start_date: document.getElementById('startDate').value,
            end_date: document.getElementById('endDate').value,
            is_active: document.getElementById('isActive').checked
        };

        // 날짜 검증
        if (new Date(missionData.end_date) < new Date(missionData.start_date)) {
            showAlert('종료일은 시작일보다 이후여야 합니다.', 'error');
            return;
        }

        let savedMissionId;

        if (missionId) {
            // 수정
            const { data, error } = await supabase
                .from('rc_weekly_mission')
                .update(missionData)
                .eq('mission_id', missionId)
                .select()
                .single();
            
            if (error) throw error;
            savedMissionId = data.mission_id;

            // 기존 상세 정보 삭제
            const { error: deleteError } = await supabase
                .from('rc_mission_detail')
                .delete()
                .eq('mission_id', savedMissionId);

            if (deleteError) throw deleteError;

            showAlert('미션이 수정되었습니다.', 'success');
        } else {
            // 등록
            const { data, error } = await supabase
                .from('rc_weekly_mission')
                .insert([missionData])
                .select()
                .single();
            
            if (error) throw error;
            savedMissionId = data.mission_id;
            showAlert('미션이 등록되었습니다.', 'success');
        }

        // 미션 상세 정보 저장
        const detailData = [];
        teams.forEach(team => {
            daysOfWeek.forEach(day => {
                const contentInput = document.querySelector(
                    `.mission-content[data-team="${team}"][data-day="${day}"]`
                );
                const distanceInput = document.querySelector(
                    `.mission-distance[data-team="${team}"][data-day="${day}"]`
                );

                const missionContent = contentInput.value.trim();
                const targetDistance = distanceInput.value ? parseFloat(distanceInput.value) : null;

                // 미션 내용이나 목표 거리가 있으면 저장
                if (missionContent || targetDistance) {
                    detailData.push({
                        mission_id: savedMissionId,
                        team: team,
                        day_of_week: day,
                        mission_content: missionContent || null,
                        target_distance: targetDistance
                    });
                }
            });
        });

        if (detailData.length > 0) {
            const { error: detailError } = await supabase
                .from('rc_mission_detail')
                .insert(detailData);

            if (detailError) throw detailError;
        }

        closeMissionModal();
        loadMissions();
    } catch (error) {
        console.error('미션 저장 오류:', error);
        showAlert('미션 저장 중 오류가 발생했습니다: ' + error.message, 'error');
    }
}

// 미션 삭제
async function deleteMission(missionId) {
    if (!confirm('정말로 이 미션을 삭제하시겠습니까? 관련된 모든 미션 상세 정보도 함께 삭제됩니다.')) {
        return;
    }

    try {
        const { error } = await supabase
            .from('rc_weekly_mission')
            .delete()
            .eq('mission_id', missionId);

        if (error) throw error;

        showAlert('미션이 삭제되었습니다.', 'success');
        loadMissions();
    } catch (error) {
        console.error('미션 삭제 오류:', error);
        showAlert('미션 삭제 중 오류가 발생했습니다: ' + error.message, 'error');
    }
}

// 모달 닫기
function closeMissionModal() {
    document.getElementById('missionModal').classList.remove('active');
    document.getElementById('missionForm').reset();
    currentEditId = null;
}

function closeMissionDetailModal() {
    document.getElementById('missionDetailModal').classList.remove('active');
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

// 페이지 로드 시 실행
document.addEventListener('DOMContentLoaded', loadMissions);
