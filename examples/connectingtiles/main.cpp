#include "Engine.h"
#include <random>

std::random_device rd;
std::mt19937 rng(rd()); 

struct Tile : RoundedRectangleComponent
{
	std::shared_ptr<TextComponent> label;

	Tile(std::vector<Entity>& entities)
	: RoundedRectangleComponent(entities, 5.0, 0.0, 0x0, 0x226699FF)
	{
		label = std::shared_ptr<TextComponent>(
			new TextComponent(entities, "2", 0xFFFFFFFF, 18.0f));
		label->setRelativePosition(entities, Vector2(0.5f, 0.3f));
		label->setAnchorPoint(entities, Vector2(0.5f, 0.5f));
		label->setRelativeSize(entities, Vector2(0.7, 1.0));

		addChild(entities, label);
	}
};

struct ConnectingTiles : Screen
{
	std::shared_ptr<FilledRectangleComponent> background;
	std::shared_ptr<ComponentGrid> board;
	std::vector<Vector2Int> selected;
	uint32_t selectedState;

	ConnectingTiles()
	: board(nullptr)
	, selectedState(0)
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
				// [this]()
				// {
				// 	auto container =  new RoundedRectangleComponent(
				// 		entities,
				// 		5.0f,
				// 		0.0f,
				// 		0x0,
				// 		0x0000FFFF
				// 	);
				// 	return container;
				// },
				[this]()
				{
					auto component = new Tile(entities);
					component->setRelativePosition(entities, Vector2(0.5, 0.5));
					component->setAnchorPoint(entities, Vector2(0.5, 0.5));
					return component;
				},
				[this](struct Component* cell, uint32_t row, uint32_t column, uint32_t state)
				{
					auto tile = dynamic_cast<Tile*>(cell);
					tile->setFillColor(entities, 0x226699FF);
					char buff[16];
					sprintf(buff, "%u", state);
					//auto label = std::dynamic_pointer_cast<TextComponent>(component->children[0]);
					tile->label->setText(entities, buff);
					printf("jhelms setting state %u -> %s\n", state, buff);

				}
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

	void fillErUp()
	{
		for (int32_t row = 0; row < board->gridSize.y; ++row)
		{
			for (int32_t column = 0; column < board->gridSize.x; ++column)
			{
				if (board->grid[row][column])
				{
					continue;
				}
				auto cell = board->spawn(entities, row, column, row*column+column);
				cell->setAlpha(entities, 0xFF);
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
				board->swapToTop(entities, cell);
				cell->selected = true;
				auto tile = std::dynamic_pointer_cast<Tile>(cell->custom);
				tile->setFillColor(entities, 0x229955FF);
				selected.push_back(Vector2Int(column, row));
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

		uint32_t lastRow = selected[selected.size()-2].y;
		uint32_t lastColumn = selected[selected.size()-2].x;
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
		if (cell && cell->selected)
		{
			cell->selected = false;
			auto tile = std::dynamic_pointer_cast<Tile>(cell->custom);
			tile->setFillColor(entities, 0x226699FF);
			return;
		}
	}

	void select(uint32_t row, uint32_t column)
	{
		auto cell = board->grid[row][column];
		if (cell && !cell->selected)
		{
			board->swapToTop(entities, cell);
			cell->selected = true;
			auto tile = std::dynamic_pointer_cast<Tile>(cell->custom);
			tile->setFillColor(entities, 0x229955FF);
		}
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
					deselect(selected[selected.size()-1].y, selected[selected.size()-1].x);
					selected.pop_back();
					return;
				}
				if (cell->selected)
				{
					return;
				}
				if (selected.size() > 0
					&& !board->areAdjacent(
						row, column, selected[selected.size()-1].y, selected[selected.size()-1].x))
				{
					// printf("not adjacent %ux%u => %ux%u\n",
					// 	row, column, selected[0].y, selected[0].x);
					return;
				}

				select(row, column);
				selected.push_back(Vector2Int(column, row));
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
		for (const Vector2Int& coordinate : selected)
		{
			uint32_t row = coordinate.y;
			uint32_t column = coordinate.x;
			auto cell = board->grid[row][column];
			cell->selected = false;
			// auto animation = std::shared_ptr<SpringAnimation>(new SpringAnimation(
			// 	cell->custom,
			// 	SpringAnimation::RelativeSize,
			// 	Vector2(2.0f, 2.0f),
			// 	1000.0f,
			// 	100.0f,
			// 	0.001f
			// ));
			auto animation = std::shared_ptr<PropertyAnimation>(new PropertyAnimation(cell));
			const Vector2 relativeSize = cell->getRelativeSize(entities);
			animation->setRelativeSize(Vector2(relativeSize.x*2.0, relativeSize.y*2.0));
			animation->setAlpha(0.0f);
			animation->disableOnComplete = true;
			//ComponentCell* cellRaw = cell.get();

			// animation->onComplete = [this, cellRaw]()
			// {
			// 	uint32_t bgStartIndex = background->getStartIndex(entities);
			// 	uint32_t cellStartIndex = cellRaw->getStartIndex(entities);
			// 	uint32_t bgEndIndex = background->getEndIndex(entities);
			// 	uint32_t cellEndIndex = cellRaw->getEndIndex(entities);
			// 	printf("cell(%p), cell->custom(%p) %ux%u => %ux%u\n", cellRaw, cellRaw->custom.get(),
			// 		background->_startIndex, bgEndIndex, cellRaw->_startIndex, cellEndIndex);
			// 	cellRaw->disable(entities);
			// 	cellRaw->setAlpha(entities, 0xFF);
			// 	auto tile = std::dynamic_pointer_cast<Tile>(cellRaw->custom);
			// 	// uint32_t color = tile->getFillColor(entities);
			// 	// printf("fill color: %u\n", color);
			// };
			cell->movement = animation;
			board->grid[row][column] = nullptr;
		}
		selected.clear();
		board->fallDown(entities);
		fillErUp();
	}

	void deselectAll()
	{
		for (const Vector2Int& coordinate : selected)
		{
			uint32_t row = coordinate.y;
			uint32_t column = coordinate.x;
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
	std::shared_ptr<Screen> mode0 = std::shared_ptr<Screen>(new ConnectingTiles());
	std::shared_ptr<Screen> mode1 = std::shared_ptr<Screen>(new Mode1());
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