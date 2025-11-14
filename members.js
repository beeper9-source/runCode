let currentEditId = null;

// 회원 목록 로드
async function loadMembers() {
    try {
        const teamFilter = document.getElementById('teamFilter').value;
        const searchText = document.getElementById('searchInput').value.toLowerCase();

        let query = supabase
            .from('rc_member')
            .select('*')
            .order('name', { ascending: true });

        if (teamFilter) {
            query = query.eq('team', teamFilter);
        }

        const { data: members, error } = await query;

        if (error) throw error;

        const tbody = document.getElementById('membersTable');
        
        if (!members || members.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="empty-state">등록된 회원이 없습니다.</td></tr>';
            return;
        }

        // 검색 필터링
        const filteredMembers = members.filter(member => {
            if (!searchText) return true;
            return member.name.toLowerCase().includes(searchText) || 
                   member.department.toLowerCase().includes(searchText);
        });

        if (filteredMembers.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="empty-state">검색 결과가 없습니다.</td></tr>';
            return;
        }

        tbody.innerHTML = filteredMembers.map(member => `
            <tr>
                <td>${member.name}</td>
                <td>${member.department}</td>
                <td>${member.team}조</td>
                <td>${member.best_10km || '-'}</td>
                <td>${member.best_half || '-'}</td>
                <td>${member.best_full || '-'}</td>
                <td>
                    <button class="btn btn-small btn-primary" onclick="editMember(${member.member_id})">수정</button>
                    <button class="btn btn-small btn-danger" onclick="deleteMember(${member.member_id})">삭제</button>
                </td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('회원 목록 로드 오류:', error);
        showAlert('회원 목록을 불러오는 중 오류가 발생했습니다.', 'error');
    }
}

// 회원 등록 모달 열기
function openMemberModal(memberId = null) {
    currentEditId = memberId;
    const modal = document.getElementById('memberModal');
    const form = document.getElementById('memberForm');
    const title = document.getElementById('modalTitle');

    if (memberId) {
        title.textContent = '회원 수정';
        loadMemberData(memberId);
    } else {
        title.textContent = '회원 등록';
        form.reset();
        document.getElementById('memberId').value = '';
    }

    modal.classList.add('active');
}

// 회원 데이터 로드 (수정용)
async function loadMemberData(memberId) {
    try {
        const { data, error } = await supabase
            .from('rc_member')
            .select('*')
            .eq('member_id', memberId)
            .single();

        if (error) throw error;

        document.getElementById('memberId').value = data.member_id;
        document.getElementById('name').value = data.name;
        document.getElementById('department').value = data.department;
        document.getElementById('team').value = data.team;
        document.getElementById('best10km').value = data.best_10km || '';
        document.getElementById('bestHalf').value = data.best_half || '';
        document.getElementById('bestFull').value = data.best_full || '';
    } catch (error) {
        console.error('회원 데이터 로드 오류:', error);
        showAlert('회원 정보를 불러오는 중 오류가 발생했습니다.', 'error');
    }
}

// 회원 수정
function editMember(memberId) {
    openMemberModal(memberId);
}

// 회원 저장
async function saveMember(event) {
    event.preventDefault();

    try {
        const memberId = document.getElementById('memberId').value;
        const memberData = {
            name: document.getElementById('name').value,
            department: document.getElementById('department').value,
            team: document.getElementById('team').value,
            best_10km: document.getElementById('best10km').value || null,
            best_half: document.getElementById('bestHalf').value || null,
            best_full: document.getElementById('bestFull').value || null
        };

        let result;
        if (memberId) {
            // 수정
            const { data, error } = await supabase
                .from('rc_member')
                .update(memberData)
                .eq('member_id', memberId)
                .select()
                .single();
            
            if (error) throw error;
            result = data;
            showAlert('회원 정보가 수정되었습니다.', 'success');
        } else {
            // 등록
            const { data, error } = await supabase
                .from('rc_member')
                .insert([memberData])
                .select()
                .single();
            
            if (error) throw error;
            result = data;
            showAlert('회원이 등록되었습니다.', 'success');
        }

        closeMemberModal();
        loadMembers();
    } catch (error) {
        console.error('회원 저장 오류:', error);
        showAlert('회원 저장 중 오류가 발생했습니다: ' + error.message, 'error');
    }
}

// 회원 삭제
async function deleteMember(memberId) {
    if (!confirm('정말로 이 회원을 삭제하시겠습니까? 관련된 모든 런닝 기록도 함께 삭제됩니다.')) {
        return;
    }

    try {
        const { error } = await supabase
            .from('rc_member')
            .delete()
            .eq('member_id', memberId);

        if (error) throw error;

        showAlert('회원이 삭제되었습니다.', 'success');
        loadMembers();
    } catch (error) {
        console.error('회원 삭제 오류:', error);
        showAlert('회원 삭제 중 오류가 발생했습니다: ' + error.message, 'error');
    }
}

// 모달 닫기
function closeMemberModal() {
    document.getElementById('memberModal').classList.remove('active');
    document.getElementById('memberForm').reset();
    currentEditId = null;
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
document.addEventListener('DOMContentLoaded', loadMembers);


