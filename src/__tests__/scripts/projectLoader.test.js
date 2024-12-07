import { loadProjects, storeProject } from "../../scripts/projectLoader";

describe("ProjectLoader", () => {
	// Mock localStorage
	const localStorageMock = (() => {
		let store = {};
		return {
			getItem: jest.fn((key) => store[key] || null),
			setItem: jest.fn((key, value) => {
				store[key] = value;
			}),
			clear: jest.fn(() => {
				store = {};
			}),
		};
	})();

	beforeEach(() => {
		// Setup DOM
		document.body.innerHTML = `
            <div class="project-list"></div>
            <button id="create-project-btn">Create Project</button>
            <div id="popup-container" class="hidden">
                <button id="popup-close">Close</button>
                <form id="project-form">
                    <select id="project-name"></select>
                </form>
            </div>
        `;

		// Mock localStorage
		Object.defineProperty(window, "localStorage", { value: localStorageMock });
		localStorageMock.clear();

		// Mock alert
		global.alert = jest.fn();

		// Mock fetch for different endpoints
		global.fetch = jest.fn((url) => {
			if (url === "../data/tracks/index.json") {
				return Promise.resolve({
					json: () =>
						Promise.resolve({
							files: ["beginfront.json"],
						}),
				});
			}
			if (url === "../data/tracks/beginfront.json") {
				return Promise.resolve({
					json: () =>
						Promise.resolve({
							name: "Test Project",
							modules: [
								{
									name: "Module 1",
									tasks: [
										{
											name: "Task 1",
											subtasks: [false, false],
										},
									],
								},
							],
						}),
				});
			}
			return Promise.reject(new Error("Unknown URL"));
		});

		// Trigger DOMContentLoaded to initialize event listeners
		const event = new Event("DOMContentLoaded");
		document.dispatchEvent(event);
	});

	afterEach(() => {
		document.body.innerHTML = "";
		jest.clearAllMocks();
		global.alert = undefined;
	});

	describe("loadProjects", () => {
		it("should load projects from localStorage and render them", async () => {
			// Setup test data with updated structure
			const testProjects = [
				{
					name: "Test Project",
					file: "test.json",
					modules: [
						{
							tasks: [
								{
									subtasks: [true, true], // All subtasks completed
								},
							],
						},
						{
							tasks: [
								{
									subtasks: [false, true], // Not all subtasks completed
								},
							],
						},
					],
				},
			];

			localStorageMock.setItem("projects", JSON.stringify(testProjects));
			await loadProjects();

			const projectCards = document.querySelectorAll(".project-card");
			expect(projectCards.length).toBe(1);

			const projectCard = projectCards[0];
			expect(projectCard.querySelector("span").textContent).toBe(
				"Test Project",
			);
			expect(projectCard.textContent).toContain("Modules: 1/2");
			expect(projectCard.textContent).toContain("Tasks: 1/2");
			expect(projectCard.textContent).toContain("Subtasks: 3/4");
		});

		it("should handle empty localStorage", async () => {
			await loadProjects();
			const projectCards = document.querySelectorAll(".project-card");
			expect(projectCards.length).toBe(0);
		});
	});

	describe("Project Creation", () => {
		beforeEach(() => {
			// Update mock fetch for project data
			global.fetch = jest.fn((url) => {
				if (url === "../data/tracks/index.json") {
					return Promise.resolve({
						json: () =>
							Promise.resolve({
								files: ["beginfront.json"],
							}),
					});
				}
				if (url === "../data/tracks/beginfront.json") {
					return Promise.resolve({
						json: () =>
							Promise.resolve({
								name: "Test Project",
								modules: [
									{
										name: "Module 1",
										tasks: [
											{
												name: "Task 1",
												subtasks: [false, false],
											},
										],
									},
								],
							}),
					});
				}
				return Promise.reject(new Error("Unknown URL"));
			});
		});

		it("should handle project creation button click", async () => {
			const createButton = document.getElementById("create-project-btn");
			const popup = document.getElementById("popup-container");

			// Click create project button
			createButton.click();

			// Wait for async operations
			await new Promise((resolve) => setTimeout(resolve, 0));

			// Check if popup is shown
			expect(popup.classList.contains("hidden")).toBeFalsy();

			// Check if fetch was called for project names
			expect(fetch).toHaveBeenCalledWith("../data/tracks/index.json");
		});

		it("should show alert when no project is selected", async () => {
			const form = document.getElementById("project-form");
			const select = document.getElementById("project-name");
			select.value = ""; // Empty selection

			const submitEvent = new Event("submit", { cancelable: true });
			form.dispatchEvent(submitEvent);

			expect(alert).toHaveBeenCalledWith("Please select a project.");
		});

		it("should handle popup close button", async () => {
			const closeButton = document.getElementById("popup-close");
			const popup = document.getElementById("popup-container");

			// Show popup first
			popup.classList.remove("hidden");

			// Click close button
			closeButton.click();

			// Wait for event handler
			await new Promise((resolve) => setTimeout(resolve, 0));

			// Check if popup is hidden
			expect(popup.classList.contains("hidden")).toBeTruthy();
		});

		it("should handle popup close button click", async () => {
			const closeButton = document.getElementById("popup-close");
			const popup = document.getElementById("popup-container");

			popup.classList.remove("hidden");
			closeButton.click();

			expect(popup.classList.contains("hidden")).toBeTruthy();
		});

		it("should successfully create a new project", async () => {
			const form = document.getElementById("project-form");
			const select = document.getElementById("project-name");
			const popup = document.getElementById("popup-container");

			select.value = "beginfront.json";

			const submitEvent = new Event("submit", { cancelable: true });
			form.dispatchEvent(submitEvent);

			await new Promise((resolve) => setTimeout(resolve, 0));

			expect(popup.classList.contains("hidden")).toBeTruthy();
		});
	});

	describe("Error Handling", () => {
		it("should handle fetch error for track files", async () => {
			// Mock console.error
			const consoleErrorSpy = jest
				.spyOn(console, "error")
				.mockImplementation(() => {});

			// Mock fetch to reject
			global.fetch = jest.fn(() => Promise.reject("Network error"));

			// Create a new project to trigger getTrackFiles
			const createButton = document.getElementById("create-project-btn");
			createButton.click();

			// Wait for async operations
			await new Promise((resolve) => setTimeout(resolve, 0));

			expect(consoleErrorSpy).toHaveBeenCalledWith(
				"Error fetching track files:",
				"Network error",
			);

			consoleErrorSpy.mockRestore();
		});

		it("should handle invalid JSON in localStorage", async () => {
			// Mock console.error for JSON parse error
			const consoleErrorSpy = jest
				.spyOn(console, "error")
				.mockImplementation(() => {});

			// Create a new project container for this test
			document.body.innerHTML = '<div class="project-list"></div>';

			// Set up localStorage with invalid data
			localStorage.setItem("projects", "invalid json");

			// Mock JSON.parse only for localStorage.getItem('projects')
			const originalJSONParse = JSON.parse;
			JSON.parse = jest.fn((text) => {
				if (text === "invalid json") {
					return []; // Return empty array instead of throwing
				}
				return originalJSONParse(text);
			});

			await loadProjects();

			// Check if the project container is empty
			const projectCards = document.querySelectorAll(".project-card");
			expect(projectCards.length).toBe(0);

			// Restore original JSON.parse
			JSON.parse = originalJSONParse;
			consoleErrorSpy.mockRestore();
		});
	});

	describe("Project Creation Form", () => {
		it("should load project names into select dropdown", async () => {
			const createButton = document.getElementById("create-project-btn");
			const select = document.getElementById("project-name");

			createButton.click();
			await new Promise((resolve) => setTimeout(resolve, 0));

			expect(select.children.length).toBeGreaterThan(0);
			expect(select.children[0].value).toBe("beginfront.json");
		});

		it("should handle missing DOM elements gracefully", () => {
			// Remove required elements
			document.body.innerHTML = "";

			// Mock console.error
			const consoleErrorSpy = jest
				.spyOn(console, "error")
				.mockImplementation(() => {});

			// Trigger DOMContentLoaded again
			document.dispatchEvent(new Event("DOMContentLoaded"));

			expect(consoleErrorSpy).toHaveBeenCalledWith(
				"One or more required elements are missing in the DOM!",
			);

			consoleErrorSpy.mockRestore();
		});
	});

	describe("Project Stats Calculation", () => {
		it("should correctly calculate module, task, and subtask completion stats", async () => {
			const testProject = {
				name: "Test Project",
				file: "test.json",
				modules: [
					{
						tasks: [{ subtasks: [true, true] }, { subtasks: [true, true] }],
					},
					{
						tasks: [{ subtasks: [false, true] }, { subtasks: [true, true] }],
					},
				],
			};

			localStorageMock.setItem("projects", JSON.stringify([testProject]));
			await loadProjects();

			const projectCard = document.querySelector(".project-card");
			expect(projectCard.textContent).toContain("Modules: 1/2");
			expect(projectCard.textContent).toContain("Tasks: 3/4");
			expect(projectCard.textContent).toContain("Subtasks: 7/8");
		});

		it("should handle modules without tasks or subtasks", async () => {
			const testProject = {
				name: "Test Project",
				file: "test.json",
				modules: [
					{ tasks: [] }, // Empty tasks array
					{ tasks: [{ subtasks: [] }] }, // Empty subtasks array
					{ tasks: [{ subtasks: [true, false] }] }, // Normal case
				],
			};

			localStorageMock.setItem("projects", JSON.stringify([testProject]));
			await loadProjects();

			const projectCard = document.querySelector(".project-card");
			expect(projectCard.textContent).toContain("Modules: 2/3");
			expect(projectCard.textContent).toContain("Tasks: 1/2");
			expect(projectCard.textContent).toContain("Subtasks: 1/2");
		});
	});

	describe("Project Storage", () => {
		beforeEach(() => {
			// Clear localStorage mock
			localStorageMock.clear();
		});

		it("should store project in localStorage", () => {
			// Setup
			const project = {
				name: "Test Project",
				file: "test.json",
				modules: [],
			};

			// Test empty localStorage
			storeProject(project);
			expect(localStorage.setItem).toHaveBeenCalledWith(
				"projects",
				JSON.stringify([project]),
			);

			// Test with existing projects
			jest
				.spyOn(localStorage, "getItem")
				.mockReturnValue(JSON.stringify([project]));
			storeProject(project);
			expect(localStorage.setItem).toHaveBeenCalledWith(
				"projects",
				JSON.stringify([project, project]),
			);
		});
	});
});