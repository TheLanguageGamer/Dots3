#include "Engine.h"
#include "words2.h"
#include <set>
#include <random>

std::random_device rd;
std::mt19937 rng(rd()); 

enum GameMode
{
	GameMode_Color,
	GameMode_Spelling,
};

struct Tile : RoundedRectangleComponent
{
	std::shared_ptr<TextComponent> label;

	Tile(std::vector<Entity>& entities, GameMode mode)
	: RoundedRectangleComponent(entities, 5.0, 3.0, 0xFFFFFF00, 0x226699FF)
	{
		if (mode == GameMode_Spelling)
		{		
			label = std::shared_ptr<TextComponent>(
				new TextComponent(entities, "A", 0xFFFFFF00, 18.0f));
			label->setRelativePosition(entities, Vector2(0.5f, 0.3f));
			label->setAnchorPoint(entities, Vector2(0.5f, 0.5f));
			label->setRelativeSize(entities, Vector2(0.7, 1.0));

			addChild(entities, label);
		}
	}
};

struct Configuration
{
	std::function<void(std::shared_ptr<ComponentCell> cell)> stateWasSet;
	std::function<void(std::shared_ptr<ComponentCell> cell)> didSelect;
	std::function<bool(std::shared_ptr<ComponentCell> cell)> canSelect;
};

// std::shared_ptr<Configuration> createColorConfiguration()
// {
// 	auto configuration = std::shared_ptr<Configuration>(new Configuration());
// }

struct ConnectingTiles : Screen
{
	GameMode mode;
	std::shared_ptr<FilledRectangleComponent> background;
	std::shared_ptr<ComponentGrid> board;
	std::vector<std::shared_ptr<ComponentCell>> selected;
	uint32_t selectedState;

	ConnectingTiles(GameMode mode)
	: board(nullptr)
	, selectedState(0)
	, mode(mode)
	{
		rootComponent = std::shared_ptr<struct Component>(new struct Component(entities));
		rootComponent->setRelativeSize(entities, Vector2(1.0f, 1.0f));

		background = std::shared_ptr<FilledRectangleComponent>(
			new FilledRectangleComponent(entities,0xFFFFFF00));

		background->setSizeMode(entities, Component::SizeMode_FixedAspectRatio);
		background->aspectRatio = 1.0f;
		background->setRelativeSize(entities, Vector2(1.0f, 1.0f));
		background->setOffsetSize(entities, Vector2(-100.0f, -100.0f));
		background->setRelativePosition(entities, Vector2(0.5f, 0.5f));
		background->setAnchorPoint(entities, Vector2(0.5f, 0.5f));
		background->setSizeMode(entities, Component::SizeMode_FixedAspectRatio);
		background->aspectRatio = 8.0/5.0;

		board = std::shared_ptr<ComponentGrid>(
			new ComponentGrid(
				entities,
				Vector2Int(8, 5),
				0.20,
				nullptr,
				[this, mode]()
				{
					auto component = new Tile(entities, mode);
					component->setRelativePosition(entities, Vector2(0.5, 0.5));
					component->setAnchorPoint(entities, Vector2(0.5, 0.5));
					return component;
				},
				nullptr
				// [this](struct Component* cell, uint32_t row, uint32_t column, uint32_t state)
				// {
				// 	deselect(row, column);
				// 	auto tile = dynamic_cast<Tile*>(cell);

				// 	char buff[16];
				// 	sprintf(buff, "%u", state);
				// 	tile->label->setText(entities, buff);

				// }
			)
		);
		board->setRelativeSize(entities, Vector2(1.0f, 1.0f));
		board->enableDrawing(
			[this](const Vector2& position)
			{
				drawingBegan(position);
			},
			[this](const Vector2& position)
			{
				drawingMoved(position);
			},
			[this](const Vector2& position)
			{
				drawingEnded(position);
			}
		);

		background->addChild(entities, board);
		rootComponent->addChild(entities, background);

		fillErUp();
	}

	uint32_t chooseState(uint32_t row, uint32_t column)
	{
		switch (mode)
		{
			case GameMode_Color:
			{
				static const std::vector<const uint32_t> colors({
					0xFF0000FF,
					0x00FF00FF,
					0x0000FFFF,
				});
				static std::uniform_int_distribution<uint32_t> dist(0, colors.size()-1);
				uint32_t index = dist(rng);

				return colors[index];
			}
			case GameMode_Spelling:
			{
				static std::uniform_int_distribution<uint32_t> dist(0, 25);
				return dist(rng);
			}
		}
	}

	void didSetState(std::shared_ptr<ComponentCell> cell)
	{
		switch (mode)
		{
			case GameMode_Color:
			{
				auto tile = std::dynamic_pointer_cast<Tile>(cell->custom);
				tile->setFillColor(entities, cell->state);
				break;
			}
			case GameMode_Spelling:
			{
				auto tile = std::dynamic_pointer_cast<Tile>(cell->custom);
				tile->setFillColor(entities, 0x226699FF);
				char buff[16];
				sprintf(buff, "%c", 'A' + (char)cell->state);
				tile->label->setText(entities, buff);
				break;
			}
		}
	}

	void fillErUp()
	{
		static std::uniform_real_distribution<> dist(-500, 500);
		for (int32_t row = 0; row < board->gridSize.y; ++row)
		{
			for (int32_t column = 0; column < board->gridSize.x; ++column)
			{
				if (board->grid[row][column])
				{
					continue;
				}
				float offset = dist(rng);
				uint32_t state = chooseState(row, column);
				auto cell = board->spawn(entities, row, column, state);
				deselect(row, column);
				didSetState(cell);
				cell->setOffsetPosition(entities, Vector2(0.0, -1000.0+offset));
				cell->setAlpha(entities, 0xFF);
				auto animation = std::dynamic_pointer_cast<PropertyAnimation>(cell->movement);
				animation->setOffsetPosition(Vector2(0.0f, 0.0f));
				animation->disableOnComplete = false;
			}
		}
		board->relayout(entities);
	}

	void drawingBegan(const Vector2& position)
	{
		printf("drawingBegan\n");
		for (int32_t row = 0; row < board->gridSize.y; ++row)
		{
			for (int32_t column = 0; column < board->gridSize.x; ++column)
			{
				auto cell = board->grid[row][column];
				if (column == 2 && row == 1)
				{
					printf("drawingBegan %4.2fx%4.2f, %4.2fx%4.2f, %4.2f, %4.2f\n",
						position.x, position.y,
						cell->screenPosition.x, cell->screenPosition.y,
						cell->screenSize.x, cell->screenSize.y);
				}
				if (!cell
					|| !doesPointIntersectRect(position, cell->screenPosition, cell->screenSize))
				{
					continue;
				}
				// if (cell->movement && !cell->movement->isComplete)
				// {
				// 	return;
				// }
				// board->swapToTop(entities, cell);
				// cell->selected = true;
				// auto tile = std::dynamic_pointer_cast<Tile>(cell->custom);
				// tile->setFillColor(entities, 0x229955FF);
				select(row, column);
				selected.push_back(cell);
				selectedState = cell->state;
			}
		}
	}

	bool shouldDeselectLast(uint32_t row, uint32_t column)
	{
		if (selected.size() <= 1)
		{
			return false;
		}

		uint32_t lastRow = selected[selected.size()-2]->row;
		uint32_t lastColumn = selected[selected.size()-2]->column;
		//printf("shouldDeselectLast %ux%u => %ux%u\n", row, column, lastRow, lastColumn);

		if (lastRow == row && lastColumn == column)
		{
			return true;
		}

		return false;
	}

	void deselect(uint32_t row, uint32_t column)
	{
		auto cell = board->grid[row][column];
		if (cell)
		{
			cell->selected = false;
			auto tile = std::dynamic_pointer_cast<Tile>(cell->custom);
			//tile->setFillColor(entities, 0x226699FF);
			tile->setStrokeColor(entities, 0xFFFFFF00);
			return;
		}
	}

	void select(uint32_t row, uint32_t column)
	{
		auto cell = board->grid[row][column];
		if (cell)
		{
			board->swapToTop(entities, cell);
			cell->selected = true;
			auto tile = std::dynamic_pointer_cast<Tile>(cell->custom);
			//tile->setFillColor(entities, 0x229955FF);
			tile->setStrokeColor(entities, 0xFFFFFFFF);
		}
	}

	bool canSelect(std::shared_ptr<ComponentCell> cell)
	{
		switch (mode)
		{
			case GameMode_Color:
			{
				if (selected.size() == 0
					|| selected[0]->state == cell->state)
				{
					return true;
				}
				break;
			}
			case GameMode_Spelling:
			{
				
				break;
			}
		}
		return false;
	}

	void drawingMoved(const Vector2& position)
	{

		for (int32_t row = 0; row < board->gridSize.y; ++row)
		{
			for (int32_t column = 0; column < board->gridSize.x; ++column)
			{
				auto cell = board->grid[row][column];
				if (!cell
					|| !doesPointIntersectRect(position, cell->screenPosition, cell->screenSize))
				{
					continue;
				}
				if (shouldDeselectLast(row, column))
				{
					deselect(selected[selected.size()-1]->row, selected[selected.size()-1]->column);
					selected.pop_back();
					return;
				}
				if (cell->selected)
				{
					return;
				}
				if (selected.size() > 0
					&& !board->areAdjacent(
						row, column, selected[selected.size()-1]->row, selected[selected.size()-1]->column))
				{
					// printf("not adjacent %ux%u => %ux%u\n",
					// 	row, column, selected[0].y, selected[0].x);
					return;
				}

				if (!canSelect(cell))
				{
					return;
				}

				select(row, column);
				selected.push_back(cell);
			}
		}
	}

	void drawingEnded(const Vector2& position)
	{
		if (selected.size() >= 1)
		{
			clearSelected();
		}
		else
		{
			deselectAll();
		}
	}

	void clearSelected()
	{
		for (auto cell : selected)
		{
			uint32_t row = cell->row;
			uint32_t column = cell->column;
			cell->selected = false;
			
			auto animation = std::dynamic_pointer_cast<PropertyAnimation>(cell->movement);
			const Vector2 relativeSize = cell->getRelativeSize(entities);
			animation->setRelativeSize(Vector2(relativeSize.x*2.0, relativeSize.y*2.0));
			animation->setAlpha(0.0f);
			animation->disableOnComplete = true;
			//cell->disable(entities);

			board->grid[row][column] = nullptr;
		}
		selected.clear();
		board->fallDown(entities);
		fillErUp();
	}

	void deselectAll()
	{
		for (auto cell : selected)
		{
			uint32_t row = cell->row;
			uint32_t column = cell->column;
			deselect(row, column);
		}
		selected.clear();
	}
};

struct Mode1 : Screen
{
	Mode1()
	{
		entities.push_back(Entity::fillCircle(Vector2(50.0f, 50.0f), 30.0f, 0xAA88FFFF));
	}
};

std::function<void()> loop;
void main_loop() { loop(); }

int main()
{
	Game game;
	std::shared_ptr<Screen> mode0 = std::shared_ptr<Screen>(new ConnectingTiles(GameMode_Color));
	std::shared_ptr<Screen> mode1 = std::shared_ptr<Screen>(new ConnectingTiles(GameMode_Spelling));
	game.setScreen(mode0);

	int32_t mode = 0;
	loop = [&]
	{
		int32_t newMode = Engine_GetMode();
		if (newMode != mode)
		{
			printf("New mode: %d\n", newMode);
			mode = newMode;
			switch (mode)
			{
				case 0:
				{
					game.setScreen(mode0);
					break;
				}
				case 1:
				{
					game.setScreen(mode1);
					break;
				}
			}
		}
		game.loop();
	};

	emscripten_set_main_loop(main_loop, 0, true);

	return 1;
}