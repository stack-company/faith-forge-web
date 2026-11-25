import { PAGINATION_REGISTRATION_LIMIT } from '@/libs/common-types/constants';
import { IUser, IUsers } from '@/libs/models';
import { PayloadAction, createSlice } from '@reduxjs/toolkit';
import {
  AssignUserRole,
  CreateUser,
  CreateUserAccount,
  GetMoreUsers,
  GetUser,
  GetUsers,
  UnassignUserRole,
  UpdateUser,
  UpdateUserAccount,
} from '../../thunks/user/user.thunk';

const initialState: IUsers = {
  data: [],
  current: undefined,
  loading: false,
  currentPage: 1,
  totalPages: 0,
  needsRefresh: false,
};

/**
 * Applies a partial user update to both `state.current` and `state.data`.
 *
 * @param {IUsers} state - Current users Redux slice state.
 * @param {string | undefined} updatedId - Target user ID.
 * @param {Partial<IUser>} patch - Partial user fields to merge.
 * @returns {void}
 */
const applyUserPatch = (
  state: IUsers,
  updatedId: string | undefined,
  patch: Partial<IUser>,
): void => {
  if (state.current && (!updatedId || state.current.id === updatedId))
    state.current = { ...state.current, ...patch };
  if (updatedId && state.data) {
    const index = state.data.findIndex((u) => u.id === updatedId);
    if (index !== -1) state.data[index] = { ...state.data[index], ...patch };
  }
  state.needsRefresh = true;
};

const userSlice = createSlice({
  name: 'user',
  initialState: initialState,
  reducers: {
    loadingUserEnable: (state) => {
      state.loading = true;
    },
    loadingUserDisable: (state) => {
      state.loading = false;
    },
    updateCurrentUser: (state, action: PayloadAction<IUser | undefined>) => {
      state.current = action.payload;
    },
    patchUserInStore: (
      state,
      action: PayloadAction<{ id: string; data: Partial<IUser> }>,
    ) => {
      applyUserPatch(state, action.payload.id, action.payload.data);
    },
    markUsersNeedsRefresh: (state) => {
      state.needsRefresh = true;
    },
    resetUsersNeedsRefresh: (state) => {
      state.needsRefresh = false;
    },
  },
  extraReducers(builder) {
    builder.addCase(GetUsers.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(GetUsers.fulfilled, (state, action) => {
      const items = action.payload.data || [];
      state.data = items;
      state.error = undefined;
      state.loading = false;
      state.currentPage = action.payload.currentPage || 1;
      if (items.length < PAGINATION_REGISTRATION_LIMIT) {
        state.totalPages = state.currentPage;
      } else {
        state.totalPages = action.payload.totalPages || state.currentPage;
      }
      state.needsRefresh = false;
    });
    builder.addCase(GetUsers.rejected, (state, action) => {
      state.data = [];
      state.error = action.error.message;
      state.loading = false;
      state.currentPage = initialState.currentPage;
      state.totalPages = initialState.totalPages;
    });
    builder.addCase(GetMoreUsers.pending, (state) => {
      state.loading = false;
    });
    builder.addCase(GetMoreUsers.fulfilled, (state, action) => {
      const newItems = action.payload.data || [];
      state.data = Array.from(state.data).concat(newItems);
      state.loading = false;
      state.currentPage = state.currentPage + 1;
      if (newItems.length < PAGINATION_REGISTRATION_LIMIT) {
        state.totalPages = state.currentPage;
      } else {
        state.totalPages = action.payload.totalPages || state.currentPage;
      }
    });
    builder.addCase(GetMoreUsers.rejected, (state, action) => {
      state.error = action.error.message;
      state.loading = false;
      state.totalPages = state.currentPage;
    });
    builder.addCase(GetUser.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(GetUser.fulfilled, (state, action) => {
      state.current = action.payload;
      state.error = undefined;
      state.loading = false;
    });
    builder.addCase(GetUser.rejected, (state, action) => {
      state.current = undefined;
      state.error = action.error.message;
      state.loading = false;
    });
    builder.addCase(CreateUser.fulfilled, (state) => {
      state.needsRefresh = true;
    });
    builder.addCase(CreateUserAccount.fulfilled, (state, action) => {
      state.needsRefresh = true;
      const { userId, username, email } = (action.meta as any)?.arg || {};
      if (state.current && (!userId || state.current.id === userId)) {
        state.current = {
          ...state.current,
          username,
          ...(email ? { email } : {}),
        };
      }
      if (userId && state.data) {
        const index = state.data.findIndex((u) => u.id === userId);
        if (index !== -1) {
          state.data[index] = {
            ...state.data[index],
            username,
            ...(email ? { email } : {}),
          };
        }
      }
    });
    builder.addCase(UpdateUserAccount.fulfilled, (state, action) => {
      state.needsRefresh = true;
      const { userId, username, email } = (action.meta as any)?.arg || {};
      if (state.current && (!userId || state.current.id === userId)) {
        state.current = {
          ...state.current,
          username,
          ...(email ? { email } : {}),
        };
      }
      if (userId && state.data) {
        const index = state.data.findIndex((u) => u.id === userId);
        if (index !== -1) {
          state.data[index] = {
            ...state.data[index],
            username,
            ...(email ? { email } : {}),
          };
        }
      }
    });
    builder.addCase(UpdateUser.fulfilled, (state, action) => {
      const updatedId = (action.meta as any)?.arg?.id || state.current?.id;
      applyUserPatch(state, updatedId, action.payload);
    });
    builder.addCase(AssignUserRole.fulfilled, (state, action) => {
      state.needsRefresh = true;
      const { userId, userRole } = (action.meta.arg as any) || {};
      if (
        state.current &&
        userRole &&
        (state.current.id === userId || !userId)
      ) {
        const currentRoles = state.current.roles || [];
        if (!currentRoles.includes(userRole))
          state.current.roles = [...currentRoles, userRole];
      }
      if (userId && state.data) {
        const item = state.data.find((u) => u.id === userId);
        if (item && userRole) {
          const currentRoles = item.roles || [];
          if (!currentRoles.includes(userRole))
            item.roles = [...currentRoles, userRole];
        }
      }
    });
    builder.addCase(UnassignUserRole.fulfilled, (state, action) => {
      state.needsRefresh = true;
      const { userId, userRole } = (action.meta.arg as any) || {};
      if (
        state.current &&
        userRole &&
        state.current.roles &&
        (state.current.id === userId || !userId)
      ) {
        state.current.roles = state.current.roles.filter((r) => r !== userRole);
      }
      if (userId && state.data) {
        const item = state.data.find((u) => u.id === userId);
        if (item && userRole && item.roles)
          item.roles = item.roles.filter((r) => r !== userRole);
      }
    });
  },
});

export const {
  loadingUserEnable,
  loadingUserDisable,
  updateCurrentUser,
  patchUserInStore,
  markUsersNeedsRefresh,
  resetUsersNeedsRefresh,
} = userSlice.actions;
export default userSlice.reducer;
